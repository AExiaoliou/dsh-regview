/**
 * Browser half of `@aexiaoliou/dsh-regview-slots`: contribute the live Slot / Factory
 * composition tree to the registry inspector.
 *
 * The host half in `src/index.ts` only lets the Loader mount the package row;
 * every registration happens here through the injected services. The source
 * polls `ctx.slots.snapshot()` only while the inspector panel is mounted, so an
 * idle page pays nothing.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { LocaleNamespaceMap } from '@deepseek-ai/dsh-client-ui-slots'
import { en, zh } from './locales.ts'
import {
  createSlotsSource, type InspectorSource, type SlotsHost, type SlotsTranslate,
} from './source.ts'

/** Copy namespace owned by this package. */
const NS = 'regview.slots'

/** Services required to read the composition tree and localize its rows. */
export const inject = ['regview', 'slots', 'locale']

/** Dictionary pair the locale registry accepts for this namespace. */
type LocaleDicts = Record<'zh' | 'en', Record<LocaleNamespaceMap[typeof NS], string>>

/**
 * The slice of the client context this plugin reads. Kept structural so the
 * package needs no type dependency on another feature's source.
 */
interface SlotsContext {
  readonly regview: {
    register(source: InspectorSource): () => void
  }
  readonly slots: SlotsHost
  readonly locale: {
    register(ns: typeof NS, dicts: LocaleDicts): () => void
    bind(ns: typeof NS): SlotsTranslate
  }
  effect(body: () => (() => void) | void, label: string): void
}

/**
 * Client plugin body: register this package's dictionaries and one inspector
 * category for the live Slot / Factory composition tree.
 * @param ctx - client root context carrying the inspector, slots, and copy.
 */
export function apply(ctx: ClientContext): void {
  const context = ctx as unknown as SlotsContext
  const t = context.locale.bind(NS)
  context.effect(() => context.locale.register(NS, { zh, en }), 'regview.slots: dictionaries')
  context.effect(
    () => context.regview.register(createSlotsSource(context.slots, t)),
    'regview.slots: source',
  )
}
