/**
 * Pure extraction and demand-driven polling of the live Slot / Factory tree.
 *
 * The extractor accepts a plain structural host (`{ snapshot(): readonly
 * LiveNode[] }`), so tests drive it with fake trees and this module never
 * touches the Cordis context. The factory wraps that host in the inspector's
 * polling contract: one 1.5s interval while at least one observer is
 * subscribed, change-only notifications, and error snapshots instead of throws.
 */
import type { RegViewKey } from './locales.ts'

/*
 * Structural copy of the inspector contract owned by `@dsh-regview/core`.
 *
 * The feature packages must not import that package's source types: their build
 * emits declarations with `rootDir: src`, and the monorepo tsconfig path mapping
 * would pull `packages/core/src` into that emit. The shapes below mirror the
 * public contract; the tests assert assignability against the real
 * `RegViewSource` at typecheck time.
 */

/** One table column, mirroring the core contract. */
export interface InspectorColumn {
  readonly key: string
  readonly label: () => string
  readonly mono?: boolean
  readonly width?: 'narrow' | 'normal' | 'wide'
  /** Allow this cell to wrap instead of forcing one line. */
  readonly wrap?: boolean
}

/** One expandable detail row, mirroring the core contract. */
export interface InspectorDetail {
  readonly label: string
  readonly value: string
}

/** One table row, mirroring the core contract. */
export interface InspectorRow {
  readonly id: string
  readonly cells: Readonly<Record<string, string>>
  readonly details?: readonly InspectorDetail[]
  readonly depth?: number
  readonly hasChildren?: boolean
}

/** One source's read, mirroring the core contract. */
export interface InspectorSnapshot {
  readonly status: 'ready' | 'error'
  readonly rows: readonly InspectorRow[]
  readonly note?: string
  readonly error?: string
  readonly truncated?: boolean
}

/** One inspector category, mirroring the core contract. */
export interface InspectorSource {
  readonly id: string
  readonly order: number
  readonly label: () => string
  readonly description?: () => string
  readonly columns: readonly InspectorColumn[]
  readonly tree?: boolean
  getSnapshot(): InspectorSnapshot
  subscribe?(listener: () => void): () => void
  refresh?(): void
}

/** Translate function bound to this package's namespace. */
export type SlotsTranslate = (key: RegViewKey, params?: Record<string, unknown>) => string

/** Stable category id contributed to the inspector. */
export const SLOTS_SOURCE_ID = 'slots'

/** Ascending category position; the composition tree lists after the registries. */
export const SLOTS_SOURCE_ORDER = 50

/** Polling cadence while at least one observer is subscribed. */
export const SLOTS_POLL_INTERVAL_MS = 1500

/** Placeholder for values the live tree does not expose. */
export const EMPTY_CELL = '—'

/** One occupant record of a live Slot declaration. */
export interface LiveOccupant {
  /** Plugin or package that registered the entry, when known. */
  readonly registrant?: string
  /** Keyed-slot cell. */
  readonly key?: string
  /** List-slot cell. */
  readonly id?: string
  /** List display order. */
  readonly order?: number
  /** Shadowing or chain priority. */
  readonly priority?: number
  /** Whether the renderer currently selects this entry. */
  readonly active?: boolean
}

/**
 * Local structural shape of one live Slot or Factory node.
 *
 * Deliberately a read-only, all-optional mirror of the renderer's
 * `LiveCompositionNode` types so this package has no runtime or type dependency
 * on `@deepseek-ai/dsh-client-ui-slots` and tests can pass object literals.
 */
export interface LiveNode {
  /** Node discriminant: an ordinary Slot declaration or a Factory definition. */
  readonly type: 'slot' | 'factory'
  /** Exact SlotMap or SlotFactoryMap key. */
  readonly name: string
  /** Slot cardinality (`single`, `list`, `keyed`, `chain`); absent on factories. */
  readonly kind?: string
  /** Runtime data scope (`root`, `session-maybe`, `session`). */
  readonly scope: string
  /** Diagnostic owner of this declaration, when known. */
  readonly declaredBy?: string
  /** Plugin or package that registered a Factory definition, when known. */
  readonly registrant?: string
  /** Current registrations of an ordinary Slot, in ledger order. */
  readonly occupants?: readonly LiveOccupant[]
  /** Nested child declarations. */
  readonly children?: readonly LiveNode[]
}

/** The only host capability the extractor needs; `ctx.slots` satisfies it. */
export interface SlotsHost {
  /** Read the live composition roots (`LiveCompositionNode[]` in the renderer). */
  snapshot(): readonly LiveNode[]
}

/** A slots source whose polling subscription and forced refresh are always present. */
export interface SlotsSource extends InspectorSource {
  /**
   * Observe changes; starts the 1.5s poll for the first subscriber and stops it
   * when the last one unsubscribes.
   * @param listener - change callback.
   * @returns idempotent unsubscribe.
   */
  subscribe(listener: () => void): () => void
  /** Re-read the live tree now, notifying observers when the result changed. */
  refresh(): void
}

/**
 * Table schema of the slots category.
 * @param t - namespace-bound translate function.
 * @returns the source's columns.
 */
function columns(t: SlotsTranslate): readonly InspectorColumn[] {
  return [
    { key: 'key', label: () => t('column.key'), mono: true },
    { key: 'kind', label: () => t('column.kind') },
    { key: 'scope', label: () => t('column.scope') },
    { key: 'declaredBy', label: () => t('column.declaredBy') },
    { key: 'occupants', label: () => t('column.occupants'), width: 'narrow' },
  ]
}

/**
 * Render one occupant's facts as a single detail value, omitting absent fields
 * and localizing the active state.
 * @param occupant - occupied entry.
 * @param t - namespace-bound translate function.
 * @returns comma-separated `field=value` pairs.
 */
function describeOccupant(occupant: LiveOccupant, t: SlotsTranslate): string {
  const parts: string[] = []
  if (occupant.registrant !== undefined) parts.push(`registrant=${occupant.registrant}`)
  if (occupant.key !== undefined) parts.push(`key=${occupant.key}`)
  if (occupant.id !== undefined) parts.push(`id=${occupant.id}`)
  if (occupant.order !== undefined) parts.push(`order=${String(occupant.order)}`)
  if (occupant.priority !== undefined) parts.push(`priority=${String(occupant.priority)}`)
  if (occupant.active !== undefined) {
    parts.push(`active=${occupant.active ? t('value.active') : t('value.inactive')}`)
  }
  return parts.length === 0 ? EMPTY_CELL : parts.join(', ')
}

/**
 * Project one live node to a table row (without recursion).
 * @param node - live Slot or Factory node.
 * @param t - namespace-bound translate function.
 * @param depth - tree depth, 0 for a root node.
 * @returns the row, including its expandable details and tree position.
 */
function rowOf(node: LiveNode, t: SlotsTranslate, depth: number): InspectorRow {
  const id = node.type === 'factory' ? `factory:${node.name}` : node.name
  const occupants = node.occupants ?? []
  const children = node.children ?? []
  const details: InspectorDetail[] = [
    { label: t('detail.children'), value: String(children.length) },
  ]
  if (node.type === 'factory') {
    details.push({ label: t('detail.registrant'), value: node.registrant ?? EMPTY_CELL })
  }
  for (const [index, occupant] of occupants.entries()) {
    details.push({
      label: t('detail.occupant', { index: index + 1 }),
      value: describeOccupant(occupant, t),
    })
  }
  return {
    id,
    cells: {
      key: id,
      kind: node.type === 'factory' ? 'factory' : (node.kind ?? EMPTY_CELL),
      scope: node.scope,
      declaredBy: node.declaredBy ?? EMPTY_CELL,
      occupants: String(occupants.length),
    },
    details,
    ...(depth > 0 ? { depth } : {}),
    ...(children.length > 0 ? { hasChildren: true } : {}),
  }
}

/**
 * Flatten a live composition forest depth-first into table rows, in source
 * order (each node before its children).
 * @param roots - composition roots (`ctx.slots.snapshot()` result).
 * @param t - namespace-bound translate function.
 * @returns flattened rows.
 */
export function flattenNodes(roots: readonly LiveNode[], t: SlotsTranslate): InspectorRow[] {
  const rows: InspectorRow[] = []
  const visit = (node: LiveNode, depth: number): void => {
    rows.push(rowOf(node, t, depth))
    for (const child of node.children ?? []) visit(child, depth + 1)
  }
  for (const root of roots) visit(root, 0)
  return rows
}

/**
 * Read one complete snapshot, converting a host read failure into the error
 * shape instead of throwing.
 * @param host - live composition host.
 * @param t - namespace-bound translate function.
 * @returns the ready or error snapshot.
 */
export function readSlotsSnapshot(host: SlotsHost, t: SlotsTranslate): InspectorSnapshot {
  try {
    return { status: 'ready', rows: flattenNodes(host.snapshot(), t), note: t('note') }
  } catch (error) {
    return {
      status: 'error',
      rows: [],
      note: t('note'),
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Build the registry-inspector source for the live Slot / Factory tree.
 *
 * Reads are not capped here: the core registry owns the 1000-row ceiling.
 * `getSnapshot` always re-reads the host (the core's locale refresh depends on
 * that), while `subscribe` surfaces changes only when the serialized snapshot
 * differs. The interval lives exactly as long as the first-to-last subscriber
 * window.
 * @param host - live composition host (`ctx.slots` in the browser plugin).
 * @param t - namespace-bound translate function.
 * @returns the source plus its guaranteed subscribe/refresh members.
 */
export function createSlotsSource(host: SlotsHost, t: SlotsTranslate): SlotsSource {
  /** Last serialized snapshot; an identical read notifies nothing. */
  let serialized: string | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  const listeners = new Set<() => void>()

  /**
   * Store a fresh read and report whether it differs from the previous one.
   * @param snapshot - freshly read snapshot.
   * @returns true when the serialized snapshot changed.
   */
  const commit = (snapshot: InspectorSnapshot): boolean => {
    const next = JSON.stringify(snapshot)
    if (next === serialized) return false
    serialized = next
    return true
  }

  const notify = (): void => {
    for (const listener of [...listeners]) listener()
  }

  /** Poll one read; notify only when the serialized snapshot changed. */
  const poll = (): void => {
    if (commit(readSlotsSnapshot(host, t))) notify()
  }

  const stop = (): void => {
    if (timer === undefined) return
    clearInterval(timer)
    timer = undefined
  }

  return {
    id: SLOTS_SOURCE_ID,
    order: SLOTS_SOURCE_ORDER,
    label: () => t('section.label'),
    description: () => t('section.description'),
    columns: columns(t),
    tree: true,
    getSnapshot: () => {
      const snapshot = readSlotsSnapshot(host, t)
      commit(snapshot)
      return snapshot
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      if (timer === undefined) timer = setInterval(poll, SLOTS_POLL_INTERVAL_MS)
      let active = true
      return () => {
        if (!active) return
        active = false
        listeners.delete(listener)
        if (listeners.size === 0) stop()
      }
    },
    refresh: () => {
      if (commit(readSlotsSnapshot(host, t))) notify()
    },
  }
}
