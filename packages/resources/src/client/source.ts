/**
 * Pure extraction of the live `ctx.resources` provider table into inspector rows.
 *
 * The factory takes the runtime service as an opaque value, so tests call it
 * with plain fakes and this module never touches the Cordis context. Only the
 * private `providers` table is read — `provider.open` is inspected for its type
 * but is never invoked, because the inspector must not open any resource.
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
export type ResourcesTranslate = (key: RegViewKey) => string

/** Stable category id contributed to the inspector. */
export const RESOURCES_SOURCE_ID = 'resources'

/** Ascending category position; the inspector lists resources first. */
export const RESOURCES_SOURCE_ORDER = 10

/** Owner package hints for the protocol providers shipped with the Web Client. */
const KNOWN_OWNERS: Readonly<Record<string, string>> = {
  file: '@deepseek-ai/dsh-api-workspace-files',
  subagentchat: '@deepseek-ai/dsh-client-ui-subagent',
  plan: '@deepseek-ai/dsh-client-ui-plan',
}

/** One provider entry read from the live table. */
export interface ProviderEntry {
  /** Protocol the provider serves; also the row id. */
  readonly protocol: string
  /** The provider's `open` member, read only to describe its type. */
  readonly open: unknown
  /** 1-based position in the live provider table (registration order). */
  readonly registrationOrder: number
}

/**
 * Describe an untrusted value's runtime type for diagnostics.
 * @param value - any value.
 * @returns a short type name.
 */
function typeName(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

/**
 * Read the private provider table and return its well-formed entries sorted by
 * protocol. Throws a diagnostic error when the table is not a `Map`.
 * @param resources - the runtime `ctx.resources` service, or a test fake.
 * @returns every provider entry with a string protocol, ordered by protocol.
 */
export function extractProviders(resources: unknown): readonly ProviderEntry[] {
  const table = typeof resources === 'object' && resources !== null
    ? (resources as { providers?: unknown }).providers
    : undefined
  if (!(table instanceof Map)) {
    throw new Error(`regview.resources: ctx.resources.providers is not a Map (got ${typeName(table)})`)
  }
  const entries: ProviderEntry[] = []
  let registrationOrder = 0
  for (const value of (table as ReadonlyMap<unknown, unknown>).values()) {
    registrationOrder += 1
    if (typeof value !== 'object' && typeof value !== 'function') continue
    if (value === null) continue
    const protocol = (value as { protocol?: unknown }).protocol
    if (typeof protocol !== 'string') continue
    entries.push({ protocol, open: (value as { open?: unknown }).open, registrationOrder })
  }
  entries.sort((left, right) => left.protocol < right.protocol ? -1 : left.protocol > right.protocol ? 1 : 0)
  return entries
}

/**
 * Build the category's column schema.
 * @param t - namespace-bound translate function.
 * @returns the three columns, with the machine-readable ones in mono.
 */
export function resourcesColumns(t: ResourcesTranslate): readonly InspectorColumn[] {
  return [
    { key: 'protocol', label: () => t('column.protocol'), mono: true, width: 'narrow' },
    { key: 'registrant', label: () => t('column.registrant') },
    { key: 'address', label: () => t('column.address'), mono: true, width: 'wide' },
  ]
}

/**
 * Describe a provider's `open` member without calling it.
 * @param open - the member read from the provider.
 * @returns a function signature hint, or its runtime type.
 */
function openTypeOf(open: unknown): string {
  return typeof open === 'function' ? 'function open(address, ctx)' : typeof open
}

/**
 * Turn one provider entry into a table row with its expandable details.
 * @param entry - provider entry read from the live table.
 * @param t - namespace-bound translate function.
 * @returns the row.
 */
function resourcesRow(entry: ProviderEntry, t: ResourcesTranslate): InspectorRow {
  const address = `dsh-resource://${entry.protocol}/…`
  const knownOwner = KNOWN_OWNERS[entry.protocol]
  const registrant = knownOwner === undefined ? t('registrant.unknown') : `${knownOwner}${t('registrant.hintSuffix')}`
  return {
    id: entry.protocol,
    cells: {
      protocol: entry.protocol,
      registrant,
      address,
    },
    details: [
      { label: t('detail.openType'), value: openTypeOf(entry.open) },
      { label: t('detail.order'), value: String(entry.registrationOrder) },
      { label: t('detail.address'), value: address },
    ],
  }
}

/**
 * Read the current provider table into a normalized snapshot. Never throws; a
 * malformed service becomes an `error` snapshot instead.
 * @param resources - the runtime `ctx.resources` service, or a test fake.
 * @param t - namespace-bound translate function.
 * @returns the snapshot the inspector renders.
 */
export function readResourcesSnapshot(resources: unknown, t: ResourcesTranslate): InspectorSnapshot {
  try {
    const rows = extractProviders(resources).map(entry => resourcesRow(entry, t))
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
 * Build the resource-protocol category.
 * @param resources - the runtime `ctx.resources` service, or a test fake.
 * @param t - namespace-bound translate function.
 * @returns the source to register with `ctx.regview`.
 */
export function createResourcesSource(resources: unknown, t: ResourcesTranslate): InspectorSource {
  return {
    id: RESOURCES_SOURCE_ID,
    order: RESOURCES_SOURCE_ORDER,
    label: () => t('section.label'),
    description: () => t('section.description'),
    columns: resourcesColumns(t),
    getSnapshot: () => readResourcesSnapshot(resources, t),
  }
}
