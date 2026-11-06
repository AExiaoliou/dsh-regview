/**
 * Pure extraction of the live `ctx.documentPreviews` registry into inspector
 * rows.
 *
 * The factory takes the runtime service as an opaque value, so tests call it
 * with plain fakes and this module never touches the Cordis context. A
 * definition's `title()` needs a file address and is never called: the table
 * shows the implementation identity instead, and the registrant is inferred
 * from that identity.
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
export type DocumentPreviewsTranslate = (key: RegViewKey) => string

/** Stable category id contributed to the inspector. */
export const DOCUMENT_PREVIEWS_SOURCE_ID = 'document-previews'

/** Ascending category position; the inspector lists document previews third. */
export const DOCUMENT_PREVIEWS_SOURCE_ORDER = 40

/** Placeholder shown for an absent or empty list. */
const EMPTY = '—'

/** One preview definition normalized from the live registry. */
export interface PreviewDefinition {
  /** Unique implementation name, also the row id. */
  readonly id: string
  /** Declared file suffixes (without a leading dot). */
  readonly extensions: readonly string[]
  /** Suffixes among `extensions` whose bytes are not text. */
  readonly binaryExtensions: readonly string[]
  /** External implementations outrank built-in ones; defaults to `extension`. */
  readonly priority: string
  /** Content delivery mode supplied by the document owner. */
  readonly loading: string
  /** Whether the implementation consumes the document's wrap preference. */
  readonly wrap: boolean
}

/**
 * Structural view of the `ctx.documentPreviews` registry. `getSnapshot` and
 * `subscribe` are checked at call time so a malformed service becomes a
 * diagnostic instead of a throw out of the inspector.
 */
interface PreviewService {
  getSnapshot(): unknown
  readonly subscribe?: unknown
}

/**
 * Validate an untrusted service value far enough to call `getSnapshot`.
 * @param value - the runtime `ctx.documentPreviews` service, or a test fake.
 * @returns the structurally narrowed service.
 * @throws when the value is not an object with a `getSnapshot` function.
 */
function asPreviewService(value: unknown): PreviewService {
  if (typeof value !== 'object' || value === null) {
    throw new Error('regview.documentPreviews: ctx.documentPreviews is not an object')
  }
  const candidate = value as { getSnapshot?: unknown }
  if (typeof candidate.getSnapshot !== 'function') {
    throw new Error('regview.documentPreviews: ctx.documentPreviews.getSnapshot is not a function')
  }
  return value as unknown as PreviewService
}

/**
 * Infer the registrant of an implementation from its id.
 * @param id - implementation id.
 * @returns the part before the last `/`, or the whole id when it has none.
 */
export function ownerOf(id: string): string {
  const slash = id.lastIndexOf('/')
  return slash === -1 ? id : id.slice(0, slash)
}

/**
 * Join a string list for one cell, or show the empty placeholder.
 * @param values - list to render.
 * @returns the joined list, or the placeholder.
 */
function joinOrDash(values: readonly string[]): string {
  return values.length === 0 ? EMPTY : values.join(', ')
}

/**
 * Keep only the string members of an untrusted array.
 * @param value - value read from a definition.
 * @returns the string members, empty when the value is not an array.
 */
function stringsOf(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

/**
 * Normalize one untrusted definition. Entries without a usable id are skipped
 * because the inspector requires a row identity.
 * @param value - one entry read from the registry snapshot.
 * @returns the normalized definition, or `undefined` when it has no string id.
 */
function parseDefinition(value: unknown): PreviewDefinition | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const candidate = value as {
    id?: unknown
    extensions?: unknown
    binaryExtensions?: unknown
    priority?: unknown
    loading?: unknown
    wrap?: unknown
  }
  const id = candidate.id
  if (typeof id !== 'string' || id === '') return undefined
  return {
    id,
    extensions: stringsOf(candidate.extensions),
    binaryExtensions: stringsOf(candidate.binaryExtensions),
    priority: typeof candidate.priority === 'string' ? candidate.priority : 'extension',
    loading: typeof candidate.loading === 'string' ? candidate.loading : EMPTY,
    wrap: candidate.wrap === true,
  }
}

/**
 * Read every registered definition. Throws when the registry read throws or
 * returns a non-array; callers decide how to report that.
 * @param documentPreviews - the runtime `ctx.documentPreviews` service.
 * @returns the normalized definitions in registration order.
 */
export function extractPreviewDefinitions(documentPreviews: unknown): readonly PreviewDefinition[] {
  const service = asPreviewService(documentPreviews)
  const snapshot: unknown = service.getSnapshot()
  if (!Array.isArray(snapshot)) {
    throw new Error('regview.documentPreviews: ctx.documentPreviews.getSnapshot did not return an array')
  }
  const definitions: PreviewDefinition[] = []
  for (const value of snapshot) {
    const definition = parseDefinition(value)
    if (definition !== undefined) definitions.push(definition)
  }
  return definitions
}

/**
 * Build the category's column schema.
 * @param t - namespace-bound translate function.
 * @returns the six columns, with the implementation id in mono.
 */
export function documentPreviewsColumns(t: DocumentPreviewsTranslate): readonly InspectorColumn[] {
  return [
    { key: 'id', label: () => t('column.id'), mono: true, width: 'wide', wrap: true },
    { key: 'extensions', label: () => t('column.extensions'), wrap: true },
    { key: 'binary', label: () => t('column.binary'), wrap: true },
    { key: 'priority', label: () => t('column.priority'), width: 'narrow' },
    { key: 'loading', label: () => t('column.loading') },
    { key: 'wrap', label: () => t('column.wrap'), width: 'narrow' },
  ]
}

/**
 * Turn one definition into a table row with its expandable details.
 * @param definition - normalized definition.
 * @param t - namespace-bound translate function.
 * @returns the row.
 */
function previewRow(definition: PreviewDefinition, t: DocumentPreviewsTranslate): InspectorRow {
  const wrap = definition.wrap ? t('wrap.yes') : t('wrap.no')
  const binary = joinOrDash(definition.binaryExtensions)
  return {
    id: definition.id,
    cells: {
      id: definition.id,
      extensions: joinOrDash(definition.extensions),
      binary,
      priority: definition.priority,
      loading: definition.loading,
      wrap,
    },
    details: [
      { label: t('detail.id'), value: definition.id },
      { label: t('detail.owner'), value: ownerOf(definition.id) },
      { label: t('detail.priority'), value: definition.priority },
      { label: t('detail.loading'), value: definition.loading },
      { label: t('detail.wrap'), value: wrap },
      { label: t('detail.binary'), value: binary },
    ],
  }
}

/**
 * Read the current registrations into a normalized snapshot. Never throws; a
 * throwing or malformed registry read becomes an `error` snapshot instead.
 * @param documentPreviews - the runtime `ctx.documentPreviews` service, or a test fake.
 * @param t - namespace-bound translate function.
 * @returns the snapshot the inspector renders.
 */
export function readDocumentPreviewsSnapshot(
  documentPreviews: unknown,
  t: DocumentPreviewsTranslate,
): InspectorSnapshot {
  try {
    const rows = extractPreviewDefinitions(documentPreviews).map(definition => previewRow(definition, t))
    return { status: 'ready', rows, note: t('note') }
  } catch (error) {
    return {
      status: 'error',
      rows: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Forward one inspector subscription to the live registry.
 * @param documentPreviews - the runtime `ctx.documentPreviews` service.
 * @param listener - change callback.
 * @returns the registry's unsubscribe.
 * @throws when the service has no callable `subscribe`.
 */
function subscribePreviewChanges(documentPreviews: unknown, listener: () => void): () => void {
  const service = asPreviewService(documentPreviews)
  const subscribe = service.subscribe
  if (typeof subscribe !== 'function') {
    throw new Error('regview.documentPreviews: ctx.documentPreviews.subscribe is not a function')
  }
  return (subscribe as (listener: () => void) => () => void)(listener)
}

/**
 * Build the document-preview category.
 * @param documentPreviews - the runtime `ctx.documentPreviews` service, or a test fake.
 * @param t - namespace-bound translate function.
 * @returns the source to register with `ctx.regview`.
 */
export function createDocumentPreviewsSource(
  documentPreviews: unknown,
  t: DocumentPreviewsTranslate,
): InspectorSource {
  return {
    id: DOCUMENT_PREVIEWS_SOURCE_ID,
    order: DOCUMENT_PREVIEWS_SOURCE_ORDER,
    label: () => t('section.label'),
    description: () => t('section.description'),
    columns: documentPreviewsColumns(t),
    getSnapshot: () => readDocumentPreviewsSnapshot(documentPreviews, t),
    subscribe: (listener) => subscribePreviewChanges(documentPreviews, listener),
  }
}
