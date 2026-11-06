/** Pure row filtering shared by the panel and its tests. */
import type { RegViewRow } from './contract.ts'

/**
 * Filter rows by a case-insensitive substring over the id, every cell, and every
 * detail label or value.
 * @param rows - source rows.
 * @param query - user query; blank keeps every row.
 * @returns a new array of matching rows.
 */
export function filterRows(rows: readonly RegViewRow[], query: string): readonly RegViewRow[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return [...rows]
  return rows.filter((row) => {
    if (row.id.toLowerCase().includes(needle)) return true
    for (const value of Object.values(row.cells)) {
      if (value.toLowerCase().includes(needle)) return true
    }
    for (const detail of row.details ?? []) {
      if (detail.label.toLowerCase().includes(needle) || detail.value.toLowerCase().includes(needle)) return true
    }
    return false
  })
}
