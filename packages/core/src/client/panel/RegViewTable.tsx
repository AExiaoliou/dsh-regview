/** One category's table: snapshot states, filtering, expansion, and counts. */
import { Fragment } from 'react'
import { IconChevronRightOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { RegViewRow, RegViewSectionInfo, RegViewSnapshot } from '../contract.ts'
import { filterRows } from '../filter.ts'
import { MAX_ROWS } from '../registry.ts'

/** Props of the internal table renderer. */
export interface RegViewTableProps {
  /** Active category schema and thunks. */
  readonly section: RegViewSectionInfo
  /** Latest snapshot, or undefined before the first read arrives. */
  readonly snapshot: RegViewSnapshot | undefined
  /** Bound copy. */
  readonly t: PropsLocale<'regview'>['t']
  /** Current filter query. */
  readonly query: string
  /** Expanded row ids. */
  readonly expanded: ReadonlySet<string>
  /** Toggle one row's details. */
  readonly onToggle: (id: string) => void
}

/**
 * Evaluate a localization thunk without letting a bad dictionary crash the page.
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
 * Render one category's rows.
 * @param props - schema, snapshot, filter, and expansion state.
 * @returns the table block, or its loading/empty/error substitute.
 */
export function RegViewTable(props: RegViewTableProps) {
  const { section, snapshot, t, query, expanded, onToggle } = props
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
  const rows = filterRows(snapshot.rows, query)
  const total = snapshot.rows.length
  const empty = total === 0 ? t('empty.rows') : t('empty.matches')
  return (
    <>
      {snapshot.note === undefined ? null : (
        <p className="dsh-regview-note">
          <strong>{t('note')}:</strong> {snapshot.note}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="dsh-regview-empty" role="status">{empty}</p>
      ) : (
        <div className="dsh-regview-table-wrap">
          <table className="dsh-regview-table">
            <thead>
              <tr>
                {section.columns.map(column => (
                  <th key={column.key} className={column.width === 'wide' ? 'dsh-regview-wide' : undefined}>
                    {safeText(column.label, column.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <Fragment key={row.id}>
                  <RegViewTableRow
                    row={row}
                    section={section}
                    expanded={expanded.has(row.id)}
                    onToggle={onToggle}
                    t={t}
                  />
                  {expanded.has(row.id) && (row.details?.length ?? 0) > 0 ? (
                    <tr className="dsh-regview-details-row">
                      <td colSpan={section.columns.length}>
                        <dl className="dsh-regview-details">
                          {(row.details ?? []).map((detail, index) => (
                            <Fragment key={`${detail.label}-${index}`}>
                              <dt>{detail.label}</dt>
                              <dd>{detail.value}</dd>
                            </Fragment>
                          ))}
                        </dl>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <footer className="dsh-regview-footer">
        <span>{t('count', { shown: rows.length, total })}</span>
        <span>{snapshot.truncated === true ? t('truncated', { max: MAX_ROWS }) : ''}</span>
      </footer>
    </>
  )
}

/** One main table row, extracting the expand affordance from the first column. */
function RegViewTableRow(props: {
  readonly row: RegViewRow
  readonly section: RegViewSectionInfo
  readonly expanded: boolean
  readonly onToggle: (id: string) => void
  readonly t: PropsLocale<'regview'>['t']
}) {
  const { row, section, expanded, onToggle, t } = props
  const expandable = (row.details?.length ?? 0) > 0
  return (
    <tr>
      {section.columns.map((column, index) => {
        const value = row.cells[column.key] ?? '—'
        return (
        <td
          key={column.key}
          data-wrap={column.wrap === true ? 'true' : undefined}
          data-label={index === 0 ? undefined : safeText(column.label, column.key)}
        >
          {index === 0 && expandable ? (
            <button
              type="button"
              className="dsh-regview-toggle"
              aria-expanded={expanded}
              aria-label={t(expanded ? 'collapse' : 'expand')}
              onClick={() => { onToggle(row.id) }}
            >
              <IconChevronRightOutlineRegular size={12} />
            </button>
          ) : null}
          <span className={column.mono === true ? 'dsh-regview-mono' : undefined} title={value}>
            {value}
          </span>
        </td>
        )
      })}
    </tr>
  )
}
