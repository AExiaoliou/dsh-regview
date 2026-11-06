/**
 * Pure extraction of the live right-Sidebar tab-type registry into inspector
 * rows.
 *
 * The factory takes the runtime registry as an opaque value, so tests call it
 * with plain fakes and this module never touches the Cordis context. Only the
 * in-force definitions are readable through `entries()`: an extension-shadowed
 * builtin is deliberately not listed. A definition's `title()` needs a tab
 * address and is never called; the table shows the implementation identity
 * instead.
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
export type SidebarTabsTranslate = (key: RegViewKey) => string

/** Stable category id contributed to the inspector. */
export const SIDEBAR_TABS_SOURCE_ID = 'sidebar-tabs'

/** Ascending category position; right-Sidebar tabs follow the resource protocols. */
export const SIDEBAR_TABS_SOURCE_ORDER = 20

/** One guide-page capsule as the source reads it; its thunks stay lazy. */
export interface TabGuideEntry {
  /** Stable entry identity, also the fallback label when `title()` fails. */
  readonly id: string
  /**
   * Capsule title in the active language.
   * @returns the title.
   */
  readonly title: () => string
  /**
   * One-line explanation in the active language.
   * @returns the description.
   */
  readonly description?: () => string
}

/**
 * One registered tab type's read-only face: the structural subset this source
 * reads from `SidebarRightTabDefinition`. The definition's `title` needs a tab
 * address and is therefore not part of this view.
 */
export interface TabDefinition {
  /** Type discriminator, unique among the in-force entries; the row id. */
  readonly kind: string
  /** This implementation's identity in the tab system. */
  readonly id: string
  /** Priority band; omitted means `extension`. */
  readonly priority?: 'extension' | 'builtin' | 'fallback'
  /** Whether each open by kind creates independent content. */
  readonly multiple?: boolean
  /** Whether a visited body stays mounted through hiding and Session changes. */
  readonly keepMounted?: boolean
  /** Resource-address globs this type recognizes. */
  readonly patterns?: readonly string[]
  /**
   * Veto for a matched address.
   * @param address - the matched address.
   * @returns whether the type opens it.
   */
  readonly canOpen?: (address: string) => boolean
  /** Entry capsules this type contributes to the guide page. */
  readonly guide?: readonly TabGuideEntry[]
}

/** Registry face the source reads; the live `ctx.sidebarRightTabs` satisfies it. */
export interface TabRegistry {
  /**
   * Registered types in force.
   * @returns the definitions in registration order.
   */
  entries(): readonly TabDefinition[]
  /**
   * Observe registry changes.
   * @param listener - synchronous invalidation callback.
   * @returns unsubscribe.
   */
  subscribe(listener: () => void): () => void
}

/** Message of an unknown failure. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Resolve copy without letting a broken thunk crash the read.
 * @param read - thunk to evaluate.
 * @param fallback - value used when the thunk throws or returns an empty string.
 * @returns the resolved text.
 */
function safeText(read: () => string, fallback: string): string {
  try {
    const value = read()
    return value === '' ? fallback : value
  } catch {
    return fallback
  }
}

/**
 * Localize a boolean cell/detail.
 * @param value - the boolean to describe.
 * @param t - namespace-bound translate function.
 * @returns the localized yes/no text.
 */
function yesNo(value: boolean, t: SidebarTabsTranslate): string {
  return value ? t('value.yes') : t('value.no')
}

/**
 * Render the patterns column: the recognized globs, or the none placeholder.
 * @param patterns - declared patterns, if any.
 * @param t - namespace-bound translate function.
 * @returns the joined patterns or the placeholder.
 */
function patternsCell(patterns: readonly string[] | undefined, t: SidebarTabsTranslate): string {
  if (patterns === undefined || patterns.length === 0) return t('value.none')
  return patterns.join(', ')
}

/**
 * Build the category's column schema.
 * @param t - namespace-bound translate function.
 * @returns the five columns, with the machine-readable ones in mono.
 */
export function sidebarTabsColumns(t: SidebarTabsTranslate): readonly InspectorColumn[] {
  return [
    { key: 'kind', label: () => t('column.kind'), mono: true, width: 'narrow' },
    { key: 'id', label: () => t('column.id'), mono: true, width: 'wide' },
    { key: 'priority', label: () => t('column.priority'), width: 'narrow' },
    { key: 'patterns', label: () => t('column.patterns'), mono: true, width: 'wide', wrap: true },
    { key: 'guides', label: () => t('column.guides'), width: 'narrow' },
  ]
}

/**
 * Turn one in-force tab type into a table row with its expandable details.
 * @param definition - the registered type.
 * @param t - namespace-bound translate function.
 * @returns the row.
 */
function sidebarTabsRow(definition: TabDefinition, t: SidebarTabsTranslate): InspectorRow {
  const guide = definition.guide ?? []
  const details: InspectorDetail[] = [
    { label: t('detail.multiple'), value: yesNo(definition.multiple === true, t) },
    { label: t('detail.keepMounted'), value: yesNo(definition.keepMounted === true, t) },
    { label: t('detail.canOpen'), value: yesNo(typeof definition.canOpen === 'function', t) },
  ]
  for (const pattern of definition.patterns ?? []) {
    details.push({ label: t('detail.pattern'), value: pattern })
  }
  // Guide copy is thunked for the active language; resolve it defensively and
  // never call the address-dependent `definition.title()`.
  for (const entry of guide) {
    const label = safeText(() => entry.title(), entry.id)
    const description = entry.description
    const value = description === undefined
      ? t('value.none')
      : safeText(description, t('value.none'))
    details.push({ label, value })
  }
  return {
    id: definition.kind,
    cells: {
      kind: definition.kind,
      id: definition.id,
      priority: definition.priority ?? 'extension',
      patterns: patternsCell(definition.patterns, t),
      guides: String(guide.length),
    },
    details,
  }
}

/**
 * Read the registry's in-force definitions into a normalized snapshot. Never
 * throws; a failing `entries()` becomes an `error` snapshot instead.
 * @param registry - the runtime `ctx.sidebarRightTabs` service, or a test fake.
 * @param t - namespace-bound translate function.
 * @returns the snapshot the inspector renders.
 */
export function readSidebarTabsSnapshot(registry: TabRegistry, t: SidebarTabsTranslate): InspectorSnapshot {
  try {
    return {
      status: 'ready',
      rows: registry.entries().map(definition => sidebarTabsRow(definition, t)),
      note: t('note'),
    }
  } catch (error) {
    return { status: 'error', rows: [], error: errorMessage(error) }
  }
}

/**
 * Build the right-Sidebar tab-type category.
 * @param registry - the runtime `ctx.sidebarRightTabs` service, or a test fake.
 * @param t - namespace-bound translate function.
 * @returns the source to register with `ctx.regview`.
 */
export function createSidebarTabsSource(registry: TabRegistry, t: SidebarTabsTranslate): InspectorSource {
  return {
    id: SIDEBAR_TABS_SOURCE_ID,
    order: SIDEBAR_TABS_SOURCE_ORDER,
    label: () => t('section.label'),
    description: () => t('section.description'),
    columns: sidebarTabsColumns(t),
    getSnapshot: () => readSidebarTabsSnapshot(registry, t),
    subscribe: listener => registry.subscribe(listener),
  }
}
