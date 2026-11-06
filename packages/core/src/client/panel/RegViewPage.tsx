/** The global panel page: category tabs, search, refresh, and the table body. */
import { useMemo, useState } from 'react'
import {
  Button, IconRefreshOutlineRegular, IconSearchOutlineRegular, Input, SegmentedTabs, type SegmentedTab,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { RegViewInjected, RegViewSectionInfo } from '../contract.ts'
import { RegViewTable } from './RegViewTable.tsx'
import { RegViewTree } from './RegViewTree.tsx'

/** Full props of the `main` slot registration. */
export type RegViewPageProps = PropsRuntime<'main'>
  & PropsLocale<'regview'>
  & InjectFace<RegViewInjected>

/**
 * Resolve a label thunk, falling back to its key/id.
 * @param read - thunk to evaluate.
 * @param fallback - value used on failure.
 * @returns the display text.
 */
function safeText(read: (() => string) | undefined, fallback: string): string {
  if (read === undefined) return fallback
  try {
    return read()
  } catch {
    return fallback
  }
}

/**
 * Map one category to a SegmentedTab descriptor.
 * @param section - category metadata.
 * @returns the tab descriptor with stable DOM ids.
 */
function tabOf(section: RegViewSectionInfo): SegmentedTab {
  return {
    value: section.id,
    label: safeText(section.label, section.id),
    id: `regview-tab-${section.id}`,
    panelId: `regview-panel-${section.id}`,
  }
}

/**
 * Render the registry inspector.
 * @param props - framework share, localized copy, and injected observables/actions.
 * @returns the page, or the no-sources state.
 */
export function RegViewPage(props: RegViewPageProps) {
  const { useSections, useSnapshots, useLocaleTick, refresh, t } = props
  const sections = useSections(snapshot => snapshot)
  const snapshots = useSnapshots(snapshot => snapshot)
  // Subscribe to locale revisions so column/description thunks are evaluated again.
  useLocaleTick(tick => tick)
  const [requested, setRequested] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())

  const first = sections[0]
  const active = useMemo(
    () => sections.find(section => section.id === requested) ?? first,
    [first, requested, sections],
  )

  const items = useMemo(() => {
    if (first === undefined) return undefined
    const rest = sections.slice(1).map(tabOf)
    return [tabOf(first), ...rest] as [SegmentedTab, ...SegmentedTab[]]
  }, [first, sections])

  if (first === undefined || active === undefined || items === undefined) {
    return (
      <div className="dsh-regview-page">
        <div className="dsh-regview-scroll">
          <div className="dsh-regview-content">
            <header className="dsh-regview-heading">
              <div>
                <h1>{t('panel.title')}</h1>
                <p className="dsh-regview-subtitle">{t('panel.description')}</p>
              </div>
            </header>
            <p className="dsh-regview-empty" role="status">{t('empty.sections')}</p>
          </div>
        </div>
      </div>
    )
  }

  const selectSection = (id: string): void => {
    setRequested(id)
    setQuery('')
    setExpanded(new Set())
  }
  const toggle = (id: string): void => {
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const description = safeText(active.description, '')

  return (
    <div className="dsh-regview-page">
      <div className="dsh-regview-scroll">
        <div className="dsh-regview-content">
          <header className="dsh-regview-heading">
            <div>
              <h1>{t('panel.title')}</h1>
              <p className="dsh-regview-subtitle">{t('panel.description')}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={<IconRefreshOutlineRegular size={14} />}
              onClick={() => { refresh(active.id) }}
            >
              {t('refresh')}
            </Button>
          </header>
          <div className="dsh-regview-toolbar">
            <div className="dsh-regview-tabs-scroll">
              <SegmentedTabs
                className="dsh-regview-tabs"
                items={items}
                value={active.id}
                onChange={selectSection}
                label={t('tabs.label')}
              />
            </div>
            <Input
              className="dsh-regview-search"
              icon={<IconSearchOutlineRegular size={16} />}
              aria-label={t('search.placeholder')}
              placeholder={t('search.placeholder')}
              value={query}
              onChange={(event) => { setQuery(event.target.value) }}
            />
          </div>
          {description === '' ? null : <p className="dsh-regview-description">{description}</p>}
          <section
            role="tabpanel"
            id={`regview-panel-${active.id}`}
            aria-labelledby={`regview-tab-${active.id}`}
          >
            {active.tree === true ? (
              <RegViewTree
                section={active}
                snapshot={snapshots.get(active.id)}
                t={t}
                query={query}
              />
            ) : (
              <RegViewTable
                section={active}
                snapshot={snapshots.get(active.id)}
                t={t}
                query={query}
                expanded={expanded}
                onToggle={toggle}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
