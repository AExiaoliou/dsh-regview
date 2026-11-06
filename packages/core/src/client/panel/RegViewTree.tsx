/** Indented collapsible tree used by sources that declare `tree: true`. */
import { Fragment, useMemo, useState } from 'react'
import { Button, IconChevronRightOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { RegViewRow, RegViewSectionInfo, RegViewSnapshot } from '../contract.ts'
import { filterRows } from '../filter.ts'

/** Props of the internal tree renderer. */
export interface RegViewTreeProps {
  /** Active category schema and thunks. */
  readonly section: RegViewSectionInfo
  /** Latest snapshot, or undefined before the first read arrives. */
  readonly snapshot: RegViewSnapshot | undefined
  /** Bound copy. */
  readonly t: PropsLocale<'regview'>['t']
  /** Current filter query. */
  readonly query: string
}

/**
 * Resolve a label thunk without letting a bad dictionary crash the page.
 * @param read - thunk to evaluate.
 * @param fallback - value used when the thunk fails.
 * @returns the resolved text.
 */
function safeText(read: () => string, fallback: string): string {
  try {
    return read()
  } catch {
    return fallback
  }
}

/**
 * Hide rows below a collapsed ancestor. Rows arrive depth-first, so a single
 * depth barrier is enough.
 * @param rows - filtered rows in depth-first order.
 * @param collapsed - ids whose descendants are hidden.
 * @returns the visible rows.
 */
function visibleRows(rows: readonly RegViewRow[], collapsed: ReadonlySet<string>): readonly RegViewRow[] {
  const visible: RegViewRow[] = []
  let hideDeeperThan = Number.POSITIVE_INFINITY
  for (const row of rows) {
    const depth = row.depth ?? 0
    if (depth > hideDeeperThan) continue
    hideDeeperThan = Number.POSITIVE_INFINITY
    visible.push(row)
    if (row.hasChildren === true && collapsed.has(row.id)) hideDeeperThan = depth
  }
  return visible
}

/**
 * Render a tree-shaped snapshot.
 * @param props - schema, snapshot, filter, and copy.
 * @returns the tree block, or its loading/empty/error substitute.
 */
export function RegViewTree(props: RegViewTreeProps) {
  const { section, snapshot, t, query } = props
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())

  const rows = useMemo(
    () => (snapshot === undefined ? [] : filterRows(snapshot.rows, query)),
    [snapshot, query],
  )
  const visible = useMemo(
    () => (query.trim() === '' ? visibleRows(rows, collapsed) : rows),
    [collapsed, query, rows],
  )

  if (snapshot === undefined) {
    return <p className="dsh-regview-empty" role="status">{t('loading')}</p>
  }
  if (snapshot.status === 'error') {
    return (
      <p className="dsh-regview-error" role="alert">
        {t('error', { message: snapshot.error ?? '' })}
      </p>
    )
  }
  const total = snapshot.rows.length
  const empty = total === 0 ? t('empty.rows') : t('empty.matches')
  const treeRows = snapshot.rows.filter(row => row.hasChildren === true)
  const toggleCollapsed = (id: string): void => {
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleDetails = (id: string): void => {
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      {snapshot.note === undefined ? null : (
        <p className="dsh-regview-note">
          <strong>{t('note')}:</strong> {snapshot.note}
        </p>
      )}
      <div className="dsh-regview-tree-toolbar">
        <span>{t('count', { shown: visible.length, total })}</span>
        <span className="dsh-regview-tree-actions">
          <Button variant="ghost" size="sm" onClick={() => { setCollapsed(new Set()) }}>
            {t('tree.expandAll')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={treeRows.length === 0}
            onClick={() => { setCollapsed(new Set(treeRows.map(row => row.id))) }}
          >
            {t('tree.collapseAll')}
          </Button>
        </span>
      </div>
      {visible.length === 0 ? (
        <p className="dsh-regview-empty" role="status">{empty}</p>
      ) : (
        <div className="dsh-regview-tree" role="tree" aria-label={safeText(section.label, section.id)}>
          {visible.map((row) => {
            const depth = row.depth ?? 0
            const hasChildren = row.hasChildren === true
            const isCollapsed = collapsed.has(row.id)
            const detailsOpen = expanded.has(row.id)
            const firstColumn = section.columns[0]
            const key = firstColumn === undefined ? row.id : (row.cells[firstColumn.key] ?? '—')
            return (
              <Fragment key={row.id}>
                <div
                  className="dsh-regview-tree-row"
                  role="treeitem"
                  aria-level={depth + 1}
                  aria-expanded={hasChildren ? !isCollapsed : undefined}
                  style={{ paddingLeft: `${12 + depth * 16}px` }}
                >
                  {hasChildren ? (
                    <button
                      type="button"
                      className="dsh-regview-toggle"
                      aria-expanded={!isCollapsed}
                      aria-label={t(isCollapsed ? 'tree.expand' : 'tree.collapse')}
                      onClick={() => { toggleCollapsed(row.id) }}
                    >
                      <IconChevronRightOutlineRegular size={12} />
                    </button>
                  ) : (
                    <span className="dsh-regview-tree-spacer" aria-hidden="true" />
                  )}
                  <span
                    className={firstColumn?.mono === true ? 'dsh-regview-mono dsh-regview-tree-key' : 'dsh-regview-tree-key'}
                    title={key}
                  >
                    {key}
                  </span>
                  {section.columns.slice(1).map(column => (
                    <span className="dsh-regview-tree-meta" key={column.key}>
                      <span className="dsh-regview-tree-meta-label">{safeText(column.label, column.key)}</span>
                      {row.cells[column.key] ?? '—'}
                    </span>
                  ))}
                  {(row.details?.length ?? 0) > 0 ? (
                    <button
                      type="button"
                      className="dsh-regview-tree-details-button"
                      aria-expanded={detailsOpen}
                      onClick={() => { toggleDetails(row.id) }}
                    >
                      {t('tree.details')}
                    </button>
                  ) : null}
                </div>
                {detailsOpen && (row.details?.length ?? 0) > 0 ? (
                  <div className="dsh-regview-tree-details" style={{ paddingLeft: `${12 + depth * 16 + 18}px` }}>
                    <dl className="dsh-regview-details">
                      {(row.details ?? []).map((detail, index) => (
                        <Fragment key={`${detail.label}-${index}`}>
                          <dt>{detail.label}</dt>
                          <dd>{detail.value}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  </div>
                ) : null}
              </Fragment>
            )
          })}
        </div>
      )}
      <footer className="dsh-regview-footer">
        <span>{t('count', { shown: visible.length, total })}</span>
        <span>{snapshot.truncated === true ? t('truncated', { max: 1000 }) : ''}</span>
      </footer>
    </>
  )
}
