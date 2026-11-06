/**
 * Browser half: provide `ctx.regview`, contribute the global panel, and own the
 * inspector's styles, copy, and locale refresh. Feature packages only register
 * data sources through the public service.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { RegViewInjected } from './contract.ts'
import { en, zh } from './locales.ts'
import { RegViewIcon } from './panel/RegViewIcon.tsx'
import { RegViewPage } from './panel/RegViewPage.tsx'
import { injectRegViewStyles } from './panel/styles.ts'
import { RegViewRegistry } from './registry.ts'

/** Copy namespace owned by this package. */
const NS = 'regview'

/** Panel id shared by the sidebar list row and the keyed `main` entry. */
const PANEL_ID = 'regview'

/** Services required to render the global panel. */
export const inject = ['slots', 'layout', 'locale']

/**
 * Provide the inspector service and register its sidebar entry and panel page.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const registry = new RegViewRegistry()
  // Built at apply's top level: feature plugins register into it from their own apply.
  ctx.reflect.provide('regview', registry)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'regview: dictionaries')
  ctx.effect(() => injectRegViewStyles(), 'regview: styles')

  const localeTick = createSnapshotStore(0)
  ctx.effect(() => ctx.locale.subscribe(() => {
    localeTick.set(localeTick.getSnapshot() + 1)
    registry.repull()
  }), 'regview: locale refresh')

  const t = ctx.locale.bind(NS)
  const injected = (): RegViewInjected => ({
    hooks: {
      sections: registry.sections,
      snapshots: registry.snapshots,
      localeTick,
    },
    refresh: (id?: string) => { registry.refresh(id) },
  })

  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    locale: NS,
    inject: injected,
  }, RegViewPage))

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 90,
    locale: NS,
    label: () => t('panel.title'),
  }, RegViewIcon))
}
