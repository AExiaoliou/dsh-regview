/**
 * Browser half of `@aexiaoliou/dsh-regview-sidebar-tabs`: contribute the live
 * right-Sidebar tab-type registry to the registry inspector.
 *
 * The host half in `src/index.ts` only lets the Loader mount the package row;
 * every registration happens here through the injected services.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { LocaleNamespaceMap } from '@deepseek-ai/dsh-client-ui-slots'
import { en, zh, type RegViewKey } from './locales.ts'
import { createSidebarTabsSource, type InspectorSource, type TabRegistry } from './source.ts'

/** Copy namespace owned by this package. */
const NS = 'regview.sidebarTabs'

/** Services required to read the tab-type registry and localize its rows. */
export const inject = ['regview', 'sidebarRightTabs', 'locale']

/** Dictionary pair the locale registry accepts for this namespace. */
type LocaleDicts = Record<'zh' | 'en', Record<LocaleNamespaceMap[typeof NS], string>>

/**
 * The slice of the client context this plugin reads. Kept structural so the
 * package needs no type dependency on another feature's source (the build emits
 * declarations with `rootDir: src`).
 */
interface SidebarTabsContext {
  readonly regview: {
    register(source: InspectorSource): () => void
  }
  readonly sidebarRightTabs: TabRegistry
  readonly locale: {
    register(ns: typeof NS, dicts: LocaleDicts): () => void
    bind(ns: typeof NS): (key: RegViewKey) => string
  }
  effect(body: () => (() => void) | void, label: string): void
}

/**
 * Client plugin body: register this package's dictionaries and one inspector
 * category for the in-force right-Sidebar tab types.
 * @param ctx - client root context carrying the inspector, the tab registry, and copy.
 */
export function apply(ctx: ClientContext): void {
  const context = ctx as unknown as SidebarTabsContext
  const t = context.locale.bind(NS)
  context.effect(() => context.locale.register(NS, { zh, en }), 'regview.sidebarTabs: dictionaries')
  const source: InspectorSource = createSidebarTabsSource(context.sidebarRightTabs, t)
  context.effect(() => context.regview.register(source), 'regview.sidebarTabs: category')
}
