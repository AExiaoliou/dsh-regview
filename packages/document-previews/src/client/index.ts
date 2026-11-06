/**
 * Browser half of `@dsh-regview/document-previews`: contribute the live
 * document-preview implementation registry to the registry inspector.
 *
 * The host half in `src/index.ts` only lets the Loader mount the package row;
 * every registration happens here through the injected services.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { LocaleNamespaceMap } from '@deepseek-ai/dsh-client-ui-slots'
import { en, zh, type RegViewKey } from './locales.ts'
import { createDocumentPreviewsSource, type InspectorSource } from './source.ts'

/** Copy namespace owned by this package. */
const NS = 'regview.documentPreviews'

/** Services required to read the registry and localize its rows. */
export const inject = ['regview', 'documentPreviews', 'locale']

/** Dictionary pair the locale registry accepts for this namespace. */
type LocaleDicts = Record<'zh' | 'en', Record<LocaleNamespaceMap[typeof NS], string>>

/**
 * The slice of the client context this plugin reads. Kept structural so the
 * package needs no type dependency on another feature's source.
 */
interface DocumentPreviewsContext {
  readonly regview: {
    register(source: InspectorSource): () => void
  }
  readonly documentPreviews: unknown
  readonly locale: {
    register(ns: typeof NS, dicts: LocaleDicts): () => void
    bind(ns: typeof NS): (key: RegViewKey) => string
  }
  effect(body: () => (() => void) | void, label: string): void
}

/**
 * Client plugin body: register this package's dictionaries and one inspector
 * category for the current document-preview definitions.
 * @param ctx - client root context carrying the inspector, registry, and copy.
 */
export function apply(ctx: ClientContext): void {
  const context = ctx as unknown as DocumentPreviewsContext
  const t = context.locale.bind(NS)
  const source = createDocumentPreviewsSource(context.documentPreviews, t)
  context.effect(() => context.locale.register(NS, { zh, en }), 'regview.documentPreviews: dictionaries')
  context.effect(() => context.regview.register(source), 'regview.documentPreviews: source')
}
