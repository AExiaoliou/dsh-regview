/**
 * Browser half of `@aexiaoliou/dsh-regview-resources`: contribute the live
 * `dsh-resource://` protocol provider table to the registry inspector.
 *
 * The host half in `src/index.ts` only lets the Loader mount the package row;
 * every registration happens here through the injected services.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { LocaleNamespaceMap } from '@deepseek-ai/dsh-client-ui-slots'
import { en, zh, type RegViewKey } from './locales.ts'
import { createResourcesSource, type InspectorSource } from './source.ts'

/** Copy namespace owned by this package. */
const NS = 'regview.resources'

/** Services required to read the provider table and localize its rows. */
export const inject = ['regview', 'resources', 'locale']

/** Dictionary pair the locale registry accepts for this namespace. */
type LocaleDicts = Record<'zh' | 'en', Record<LocaleNamespaceMap[typeof NS], string>>

/**
 * The slice of the client context this plugin reads. Kept structural so the
 * package needs no type dependency on another feature's source.
 */
interface ResourcesContext {
  readonly regview: {
    register(source: InspectorSource): () => void
  }
  readonly resources: unknown
  readonly locale: {
    register(ns: typeof NS, dicts: LocaleDicts): () => void
    bind(ns: typeof NS): (key: RegViewKey) => string
  }
  effect(body: () => (() => void) | void, label: string): void
}

/**
 * Client plugin body: register this package's dictionaries and one inspector
 * category for the current protocol providers.
 * @param ctx - client root context carrying the inspector, resources, and copy.
 */
export function apply(ctx: ClientContext): void {
  const context = ctx as unknown as ResourcesContext
  const t = context.locale.bind(NS)
  const source = createResourcesSource(context.resources, t)
  context.effect(() => context.locale.register(NS, { zh, en }), 'regview.resources: dictionaries')
  context.effect(() => context.regview.register(source), 'regview.resources: source')
}
