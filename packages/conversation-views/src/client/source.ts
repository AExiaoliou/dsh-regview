/**
 * Pure extraction of the live `conversation.view` slot entries into inspector
 * rows.
 *
 * The factory takes the runtime slot registry as an opaque value, so tests call
 * it with plain fakes and this module never touches the Cordis context. The
 * slot registry is read by name, not typed through another feature's SlotMap
 * augmentation: this package needs no compile-time dependency on the
 * conversation UI that declares the slot.
 */
import type { RegViewKey } from './locales.ts'

/*
 * Structural copy of the inspector contract owned by `@aexiaoliou/dsh-regview-core`.
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
  getSnapshot(): InspectorSnapshot
  subscribe?(listener: () => void): () => void
  refresh?(): void
}

/** Translate function bound to this package's namespace. */
export type ConversationViewsTranslate = (key: RegViewKey) => string

/** Stable category id contributed to the inspector. */
export const CONVERSATION_VIEWS_SOURCE_ID = 'conversation-views'

/** Ascending category position; conversation views follow document previews. */
export const CONVERSATION_VIEWS_SOURCE_ORDER = 30

/** Slot key whose entries this source reports. */
export const CONVERSATION_VIEW_SLOT = 'conversation.view'

/**
 * Package identities of the views shipped by the Web shell. A statically linked
 * plugin's fiber name is a minified identifier, so these two stable ids map to
 * their package instead; dynamic plugins keep their recorded fiber name.
 */
const KNOWN_VIEW_OWNERS: Readonly<Record<string, string>> = {
  chat: '@deepseek-ai/dsh-client-ui-chat',
  trajectory: '@deepseek-ai/dsh-client-ui-trajectory',
}

/**
 * One list-entry label: a plain string, or a thunk re-evaluated per read so the
 * tab follows the active locale without re-registration.
 */
export type ViewLabel = string | (() => string)

/** One slot entry's list-shape options; only the members this source reads. */
export interface ConversationViewOptions {
  /** List-entry identity; absent or empty entries are skipped. */
  readonly id?: string
  /** Display label, either concrete or a locale-following thunk. */
  readonly label?: ViewLabel
  /** List display order; omitted means 0. */
  readonly order?: number
  /** Keyed-cell identity, when the entry declares one. */
  readonly key?: string
}

/** One slot entry as the source reads it. */
export interface ConversationViewEntry {
  /** The registration's list-shape options. */
  readonly options: ConversationViewOptions
  /** Diagnostics label of who registered the entry. */
  readonly registrant?: string
}

/** Slot-registry face the source reads; the live `ctx.slots` satisfies it. */
export interface ConversationViewSlots {
  /**
   * Entries registered into one slot key.
   * @param key - the slot key.
   * @returns the entries in registration order.
   */
  entries(key: string): readonly ConversationViewEntry[]
  /**
   * Observe one slot key's registration changes.
   * @param key - the slot key.
   * @param listener - synchronous invalidation callback.
   * @returns unsubscribe.
   */
  subscribe(key: string, listener: () => void): () => void
}

/** Message of an unknown failure. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Resolve a possibly-thunked label, falling back to the entry id.
 * @param label - the stored label.
 * @param id - the entry id used when the label is absent or its thunk fails.
 * @returns the display label.
 */
export function resolveViewLabel(label: ViewLabel | undefined, id: string): string {
  if (typeof label === 'string') return label
  if (typeof label !== 'function') return id
  try {
    return label()
  } catch {
    return id
  }
}

/**
 * Build the category's column schema.
 * @param t - namespace-bound translate function.
 * @returns the four columns, with the machine-readable id in mono.
 */
export function conversationViewsColumns(t: ConversationViewsTranslate): readonly InspectorColumn[] {
  return [
    { key: 'id', label: () => t('column.id'), mono: true, width: 'wide' },
    { key: 'label', label: () => t('column.label') },
    { key: 'order', label: () => t('column.order'), width: 'narrow' },
    { key: 'registrant', label: () => t('column.registrant') },
  ]
}

/**
 * Turn one slot entry into a table row with its expandable details.
 * @param entry - the registered entry.
 * @param id - the entry's string id, already validated.
 * @param t - namespace-bound translate function.
 * @returns the row.
 */
function conversationViewRow(entry: ConversationViewEntry, id: string, t: ConversationViewsTranslate): InspectorRow {
  const registrant = KNOWN_VIEW_OWNERS[id] ?? entry.registrant ?? t('value.none')
  const order = entry.options.order ?? 0
  const details: InspectorDetail[] = [
    { label: t('detail.registrant'), value: registrant },
    { label: t('detail.order'), value: String(order) },
  ]
  if (entry.options.key !== undefined) {
    details.push({ label: t('detail.key'), value: entry.options.key })
  }
  return {
    id,
    cells: {
      id,
      label: resolveViewLabel(entry.options.label, id),
      order: String(order),
      registrant,
    },
    details,
  }
}

/**
 * Read the slot's entries into a normalized snapshot. Never throws; a failing
 * `entries()` becomes an `error` snapshot instead.
 * @param slots - the runtime `ctx.slots` service, or a test fake.
 * @param t - namespace-bound translate function.
 * @returns the snapshot the inspector renders.
 */
export function readConversationViewsSnapshot(
  slots: ConversationViewSlots,
  t: ConversationViewsTranslate,
): InspectorSnapshot {
  try {
    const rows: InspectorRow[] = []
    for (const entry of slots.entries(CONVERSATION_VIEW_SLOT)) {
      const id = entry.options.id
      // Entries without an id are not list tabs, and an empty id cannot be a
      // table row id (the inspector rejects it), so both are skipped.
      if (typeof id !== 'string' || id === '') continue
      rows.push(conversationViewRow(entry, id, t))
    }
    return { status: 'ready', rows, note: t('note') }
  } catch (error) {
    return { status: 'error', rows: [], error: errorMessage(error) }
  }
}

/**
 * Build the conversation-view category.
 * @param slots - the runtime `ctx.slots` service, or a test fake.
 * @param t - namespace-bound translate function.
 * @returns the source to register with `ctx.regview`.
 */
export function createConversationViewsSource(
  slots: ConversationViewSlots,
  t: ConversationViewsTranslate,
): InspectorSource {
  return {
    id: CONVERSATION_VIEWS_SOURCE_ID,
    order: CONVERSATION_VIEWS_SOURCE_ORDER,
    label: () => t('section.label'),
    description: () => t('section.description'),
    columns: conversationViewsColumns(t),
    getSnapshot: () => readConversationViewsSnapshot(slots, t),
    subscribe: listener => slots.subscribe(CONVERSATION_VIEW_SLOT, listener),
  }
}
