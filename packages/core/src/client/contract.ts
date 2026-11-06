/**
 * Public browser contract of the registry inspector.
 *
 * A feature package contributes one {@link RegViewSource}; the base plugin owns
 * every presentation detail and reads sources through {@link RegViewService}.
 * Rows and details are JSON-compatible strings so a source can live in another
 * plugin without importing this package's runtime.
 */
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'

/** One table column a source contributes. */
export interface RegViewColumn {
  /** Cell key in {@link RegViewRow.cells}. */
  readonly key: string
  /** Localized header, evaluated on every render so a language switch follows. */
  readonly label: () => string
  /** Render the cell in the code font. */
  readonly mono?: boolean
  /** Preferred width band; the table treats every value as advisory. */
  readonly width?: 'narrow' | 'normal' | 'wide'
  /** Allow this cell to wrap; default false keeps one line and scrolls instead. */
  readonly wrap?: boolean
}

/** One expandable detail row under a table row. */
export interface RegViewDetail {
  /** Localized detail label. */
  readonly label: string
  /** Plain value; long values wrap. */
  readonly value: string
}

/** One table row a source contributes. */
export interface RegViewRow {
  /** Stable row identity within its source. */
  readonly id: string
  /** Plain text per declared column key. */
  readonly cells: Readonly<Record<string, string>>
  /** Optional expandable facts. */
  readonly details?: readonly RegViewDetail[]
  /** Tree depth for a tree section; default 0. */
  readonly depth?: number
  /** Whether this tree row has children that can be collapsed. */
  readonly hasChildren?: boolean
}

/** One source's current read, including its own failure state. */
export interface RegViewSnapshot {
  /** `ready` renders rows; `error` renders the failure and keeps any rows. */
  readonly status: 'ready' | 'error'
  /** Table rows in source order. */
  readonly rows: readonly RegViewRow[]
  /** Localized caveat shown above the table. */
  readonly note?: string
  /** Localized failure text, present when `status` is `error`. */
  readonly error?: string
  /** True when the source capped its rows. */
  readonly truncated?: boolean
}

/** One registry category contributed by a feature plugin. */
export interface RegViewSource {
  /** Stable category identity, unique across the inspector. */
  readonly id: string
  /** Ascending category position; registration order breaks ties. */
  readonly order: number
  /** Localized category label, evaluated on every render. */
  readonly label: () => string
  /** Localized one-line explanation, evaluated on every render. */
  readonly description?: () => string
  /** Table schema this source returns rows for. */
  readonly columns: readonly RegViewColumn[]
  /** Render rows as an indented collapsible tree instead of a table. */
  readonly tree?: boolean
  /** Read the current rows; may throw, which the inspector reports as an error. */
  getSnapshot(): RegViewSnapshot
  /** Observe changes; the inspector subscribes only while its panel is mounted. */
  subscribe?(listener: () => void): () => void
  /** Re-read external state after the inspector's refresh action. */
  refresh?(): void
}

/** What feature plugins receive as `ctx.regview`. */
export interface RegViewService {
  /**
   * Contribute one category for the caller's lifetime.
   * @param source - category definition and its read function.
   * @returns idempotent disposer held inside the caller's `ctx.effect`.
   * @throws when the id is empty or already registered, or the columns are malformed.
   */
  register(source: RegViewSource): () => void
  /**
   * Refresh one category, or every category when no id is given.
   * @param id - category id.
   */
  refresh(id?: string): void
}

/** One normalized category as the base plugin's panel reads it. */
export interface RegViewSectionInfo {
  /** Category identity. */
  readonly id: string
  /** Ascending position. */
  readonly order: number
  /** Localized label thunk. */
  readonly label: () => string
  /** Localized description thunk. */
  readonly description?: () => string
  /** Table schema. */
  readonly columns: readonly RegViewColumn[]
  /** Tree presentation requested by the source. */
  readonly tree?: boolean
}

/** Injected action and observable face of the panel. */
export interface RegViewInjected {
  /** Observable sources bound to `useSections`, `useSnapshots`, and `useLocaleTick`. */
  readonly hooks: {
    readonly sections: ObservableSnapshot<readonly RegViewSectionInfo[]>
    readonly snapshots: ObservableSnapshot<ReadonlyMap<string, RegViewSnapshot>>
    readonly localeTick: ObservableSnapshot<number>
  }
  /** Refresh the active category, or all categories when no id is given. */
  readonly refresh: (id?: string) => void
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Registry-inspector category registry provided by `@aexiaoliou/dsh-regview-core`. */
    regview: RegViewService
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Base plugin copy: panel chrome, table, states, and common column names. */
    regview: import('./locales.ts').RegViewKey
  }
}
