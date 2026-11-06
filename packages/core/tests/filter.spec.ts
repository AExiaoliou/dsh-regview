import { describe, expect, it } from 'vitest'
import type { RegViewRow } from '../src/client/contract.ts'
import { filterRows } from '../src/client/filter.ts'

const rows: readonly RegViewRow[] = [
  { id: 'file', cells: { protocol: 'file', owner: '@deepseek-ai/dsh-api-workspace-files' } },
  {
    id: 'plan',
    cells: { protocol: 'plan', owner: 'Not exposed' },
    details: [{ label: 'Registration order', value: '2' }],
  },
]

describe('filterRows', () => {
  it('keeps every row for a blank query', () => {
    expect(filterRows(rows, '   ')).toHaveLength(2)
  })

  it('matches ids and cells case-insensitively', () => {
    expect(filterRows(rows, 'FILE').map(row => row.id)).toEqual(['file'])
    expect(filterRows(rows, 'workspace').map(row => row.id)).toEqual(['file'])
  })

  it('matches detail labels and values', () => {
    expect(filterRows(rows, 'registration').map(row => row.id)).toEqual(['plan'])
    expect(filterRows(rows, '2').map(row => row.id)).toEqual(['plan'])
  })

  it('returns no rows when nothing matches', () => {
    expect(filterRows(rows, 'nope')).toEqual([])
  })
})
