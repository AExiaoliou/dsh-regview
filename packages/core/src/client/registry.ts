/**
 * Category registry and demand-driven snapshot aggregation.
 *
 * Sources register from feature plugins. The panel subscribes to `snapshots`
 * only while it is mounted, so a polling source (the Slot tree) stops when the
 * user leaves the panel instead of running for the page lifetime.
 */
import { createSnapshotStore, notifySubscribers, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type {
  RegViewDetail, RegViewRow, RegViewSectionInfo, RegViewService, RegViewSnapshot, RegViewSource,
} from './contract.ts'

/** Rows one category may return before the inspector truncates it. */
export const MAX_ROWS = 1000

/** A registered source plus its last published state. */
interface StoredSource {
  readonly source: RegViewSource
  readonly sequence: number
  /** Last published serialization; identical reads publish nothing. */
  serialized: string | undefined
}

/**
 * Normalize an untrusted read into the public snapshot shape.
 * @param source - category whose read returned the value.
 * @param value - the value the source returned.
 * @returns a detached, serializable snapshot.
 */
function normalize(source: RegViewSource, value: RegViewSnapshot): RegViewSnapshot {
  if (value.status !== 'ready' && value.status !== 'error') {
    throw new Error(`regview: source "${source.id}" returned an unknown status`)
  }
  const rawRows: unknown = value.rows
  if (!Array.isArray(rawRows)) {
    throw new Error(`regview: source "${source.id}" returned no rows array`)
  }
  const rows = (rawRows as readonly RegViewRow[]).map((row, index) => {
    if (typeof row !== 'object' || row === null || typeof row.id !== 'string' || row.id === '') {
      throw new Error(`regview: source "${source.id}" row ${index} has no id`)
    }
    if (typeof row.cells !== 'object' || row.cells === null) {
      throw new Error(`regview: source "${source.id}" row "${row.id}" has no cells`)
    }
    const cells: Record<string, string> = {}
    for (const [key, cell] of Object.entries(row.cells)) {
      cells[key] = typeof cell === 'string' ? cell : String(cell)
    }
    const details = row.details?.map((detail: RegViewDetail) => ({
      label: String(detail.label),
      value: String(detail.value),
    }))
    return {
      id: row.id,
      cells,
      ...(details === undefined ? {} : { details }),
      ...(typeof row.depth === 'number' && row.depth > 0 ? { depth: row.depth } : {}),
      ...(row.hasChildren === true ? { hasChildren: true } : {}),
    }
  })
  const truncated = value.truncated === true || rows.length > MAX_ROWS
  const kept = truncated ? rows.slice(0, MAX_ROWS) : rows
  return {
    status: value.status,
    rows: kept,
    ...(value.note === undefined ? {} : { note: value.note }),
    ...(value.error === undefined ? {} : { error: value.error }),
    ...(truncated ? { truncated: true } : {}),
  }
}

/** The `ctx.regview` implementation. */
export class RegViewRegistry implements RegViewService {
  private readonly stored = new Map<string, StoredSource>()
  private readonly subscriptions = new Map<string, () => void>()
  private readonly sectionsStore: SnapshotStore<readonly RegViewSectionInfo[]>
  private readonly snapshotStore: SnapshotStore<ReadonlyMap<string, RegViewSnapshot>>
  private readonly listeners = new Set<() => void>()
  private subscribers = 0
  private sequence = 0
  private sectionCache: readonly RegViewSectionInfo[] = []

  /** Snapshot observable the panel consumes through its injected `useSnapshots` hook. */
  readonly snapshots: ObservableSnapshot<ReadonlyMap<string, RegViewSnapshot>>

  constructor() {
    this.sectionsStore = createSnapshotStore<readonly RegViewSectionInfo[]>(this.sectionCache)
    this.snapshotStore = createSnapshotStore<ReadonlyMap<string, RegViewSnapshot>>(new Map())
    this.snapshots = {
      getSnapshot: () => this.snapshotStore.getSnapshot(),
      subscribe: (listener) => {
        this.subscribers += 1
        if (this.subscribers === 1) this.attachAll()
        const unsubscribe = this.snapshotStore.subscribe(listener)
        let active = true
        return () => {
          if (!active) return
          active = false
          unsubscribe()
          this.subscribers -= 1
          if (this.subscribers === 0) this.detachAll()
        }
      },
    }
  }

  /** Category metadata, sorted by `order` then registration order. */
  get sections(): ObservableSnapshot<readonly RegViewSectionInfo[]> {
    return this.sectionsStore
  }

  register(source: RegViewSource): () => void {
    if (typeof source.id !== 'string' || source.id.trim() === '') {
      throw new Error('regview: a source id must be a non-empty string')
    }
    if (this.stored.has(source.id)) {
      throw new Error(`regview: source "${source.id}" is already registered`)
    }
    if (!Array.isArray(source.columns) || source.columns.length === 0) {
      throw new Error(`regview: source "${source.id}" declares no columns`)
    }
    const keys = new Set<string>()
    for (const column of source.columns) {
      if (typeof column.key !== 'string' || column.key === '') {
        throw new Error(`regview: source "${source.id}" has a column without a key`)
      }
      if (keys.has(column.key)) throw new Error(`regview: source "${source.id}" repeats column "${column.key}"`)
      keys.add(column.key)
    }
    const stored: StoredSource = { source, sequence: this.sequence++, serialized: undefined }
    this.stored.set(source.id, stored)
    this.pull(stored)
    if (this.subscribers > 0) this.attach(stored)
    this.publishSections()
    let active = true
    return () => {
      if (!active) return
      active = false
      this.detach(source.id)
      this.stored.delete(source.id)
      const next = new Map(this.snapshotStore.getSnapshot())
      next.delete(source.id)
      this.snapshotStore.set(next)
      this.publishSections()
    }
  }

  refresh(id?: string): void {
    if (id !== undefined) {
      const stored = this.stored.get(id)
      if (stored === undefined) return
      this.refreshOne(stored)
      return
    }
    for (const stored of this.stored.values()) this.refreshOne(stored)
  }

  /** Re-read every source without invoking its refresh hook (locale changes). */
  repull(): void {
    for (const stored of this.stored.values()) this.pull(stored)
  }

  private refreshOne(stored: StoredSource): void {
    try {
      stored.source.refresh?.()
    } catch (error) {
      this.recordError(stored, error)
      return
    }
    this.pull(stored)
  }

  private pull(stored: StoredSource): void {
    let snapshot: RegViewSnapshot
    try {
      snapshot = normalize(stored.source, stored.source.getSnapshot())
    } catch (error) {
      this.recordError(stored, error)
      return
    }
    const serialized = JSON.stringify(snapshot)
    if (serialized === stored.serialized) return
    stored.serialized = serialized
    const next = new Map(this.snapshotStore.getSnapshot())
    next.set(stored.source.id, snapshot)
    this.snapshotStore.set(next)
  }

  private recordError(stored: StoredSource, error: unknown): void {
    const snapshot: RegViewSnapshot = {
      status: 'error',
      rows: [],
      error: error instanceof Error ? error.message : String(error),
    }
    const serialized = JSON.stringify(snapshot)
    if (serialized === stored.serialized) return
    stored.serialized = serialized
    const next = new Map(this.snapshotStore.getSnapshot())
    next.set(stored.source.id, snapshot)
    this.snapshotStore.set(next)
  }

  private attach(stored: StoredSource): void {
    if (stored.source.subscribe === undefined) return
    if (this.subscriptions.has(stored.source.id)) return
    try {
      this.subscriptions.set(stored.source.id, stored.source.subscribe(() => { this.pull(stored) }))
      this.pull(stored)
    } catch (error) {
      this.recordError(stored, error)
    }
  }

  private detach(id: string): void {
    const unsubscribe = this.subscriptions.get(id)
    if (unsubscribe === undefined) return
    this.subscriptions.delete(id)
    unsubscribe()
  }

  private attachAll(): void {
    for (const stored of this.stored.values()) this.attach(stored)
  }

  private detachAll(): void {
    for (const id of [...this.subscriptions.keys()]) this.detach(id)
  }

  private publishSections(): void {
    const next = [...this.stored.values()]
      .sort((left, right) => left.source.order - right.source.order || left.sequence - right.sequence)
      .map(({ source }): RegViewSectionInfo => ({
        id: source.id,
        order: source.order,
        label: source.label,
        ...(source.description === undefined ? {} : { description: source.description }),
        columns: source.columns,
        ...(source.tree === true ? { tree: true } : {}),
      }))
    const previous = this.sectionCache
    const unchanged = previous.length === next.length && previous.every((section, index) => {
      const candidate = next[index]
      return candidate !== undefined && section.id === candidate.id && section.order === candidate.order
    })
    if (unchanged) return
    this.sectionCache = next
    this.sectionsStore.set(next)
    notifySubscribers(this.listeners, '[regview] section listeners')
  }

  /**
   * Observe category registrations independent of the panel subscription.
   * @param listener - synchronous invalidation callback.
   * @returns unsubscribe.
   */
  subscribeSections(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
}
