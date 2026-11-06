import { describe, expect, it, vi } from 'vitest'
import type { RegViewSource, RegViewSnapshot } from '../src/client/contract.ts'
import { MAX_ROWS, RegViewRegistry } from '../src/client/registry.ts'

function ready(rows: RegViewSnapshot['rows'] = [{ id: 'r1', cells: { name: 'first' } }]): RegViewSnapshot {
  return { status: 'ready', rows }
}

function source(overrides: Partial<RegViewSource> = {}): RegViewSource {
  return {
    id: 'test',
    order: 10,
    label: () => 'Test',
    columns: [{ key: 'name', label: () => 'Name' }],
    getSnapshot: () => ready(),
    ...overrides,
  }
}

describe('RegViewRegistry', () => {
  it('sorts categories by order and registration sequence', () => {
    const registry = new RegViewRegistry()
    registry.register(source({ id: 'late', order: 20 }))
    registry.register(source({ id: 'early', order: 10 }))
    registry.register(source({ id: 'early-2', order: 10 }))
    expect(registry.sections.getSnapshot().map(section => section.id)).toEqual(['early', 'early-2', 'late'])
  })

  it('publishes the initial snapshot before any subscriber arrives', () => {
    const registry = new RegViewRegistry()
    registry.register(source())
    expect(registry.snapshots.getSnapshot().get('test')?.rows[0]?.cells.name).toBe('first')
  })

  it('rejects duplicate ids and malformed columns', () => {
    const registry = new RegViewRegistry()
    registry.register(source())
    expect(() => registry.register(source())).toThrow(/already registered/)
    expect(() => registry.register(source({ id: 'bad', columns: [] }))).toThrow(/no columns/)
    expect(() => registry.register(source({ id: 'dup-col', columns: [
      { key: 'a', label: () => 'A' },
      { key: 'a', label: () => 'A again' },
    ] }))).toThrow(/repeats column/)
  })

  it('subscribes to sources only while the panel holds the snapshot observable', () => {
    const registry = new RegViewRegistry()
    let notify: (() => void) | undefined
    const unsubscribe = vi.fn(() => { notify = undefined })
    let value = 'first'
    const subscribe = vi.fn((listener: () => void) => {
      notify = listener
      return unsubscribe
    })
    registry.register(source({
      subscribe,
      getSnapshot: () => ready([{ id: 'r1', cells: { name: value } }]),
    }))
    expect(subscribe).not.toHaveBeenCalled()

    const release = registry.snapshots.subscribe(() => {})
    expect(subscribe).toHaveBeenCalledTimes(1)

    value = 'second'
    notify?.()
    expect(registry.snapshots.getSnapshot().get('test')?.rows[0]?.cells.name).toBe('second')

    release()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('publishes nothing when a source read is unchanged', () => {
    const registry = new RegViewRegistry()
    let listener: (() => void) | undefined
    registry.register(source({ subscribe: (fn) => { listener = fn; return () => { listener = undefined } } }))
    const seen = vi.fn()
    const release = registry.snapshots.subscribe(seen)
    listener?.()
    expect(seen).not.toHaveBeenCalled()
    release()
  })

  it('records a source failure as an error snapshot', () => {
    const registry = new RegViewRegistry()
    registry.register(source({ id: 'boom', getSnapshot: () => { throw new Error('kaput') } }))
    const snapshot = registry.snapshots.getSnapshot().get('boom')
    expect(snapshot?.status).toBe('error')
    expect(snapshot?.error).toContain('kaput')
  })

  it('refreshes one source or every source', () => {
    const registry = new RegViewRegistry()
    const first = vi.fn()
    const second = vi.fn()
    registry.register(source({ id: 'first', refresh: first }))
    registry.register(source({ id: 'second', refresh: second }))
    registry.refresh('first')
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
    registry.refresh()
    expect(first).toHaveBeenCalledTimes(2)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('removes a disposed source from both observables', () => {
    const registry = new RegViewRegistry()
    const dispose = registry.register(source())
    dispose()
    expect(registry.sections.getSnapshot()).toEqual([])
    expect(registry.snapshots.getSnapshot().has('test')).toBe(false)
  })

  it('normalizes untrusted values and caps rows', () => {
    const registry = new RegViewRegistry()
    const rows = Array.from({ length: MAX_ROWS + 5 }, (_, index) => ({ id: `row-${index}`, cells: { name: String(index) } }))
    registry.register(source({ getSnapshot: () => ready(rows) }))
    const snapshot = registry.snapshots.getSnapshot().get('test')
    expect(snapshot?.rows).toHaveLength(MAX_ROWS)
    expect(snapshot?.truncated).toBe(true)
  })

  it('preserves tree metadata and row depth', () => {
    const registry = new RegViewRegistry()
    registry.register(source({
      id: 'tree',
      tree: true,
      getSnapshot: () => ready([
        { id: 'root', cells: { name: 'root' }, hasChildren: true },
        { id: 'child', cells: { name: 'child' }, depth: 1 },
      ]),
    }))
    expect(registry.sections.getSnapshot()[0]?.tree).toBe(true)
    const rows = registry.snapshots.getSnapshot().get('tree')?.rows
    expect(rows?.[0]?.hasChildren).toBe(true)
    expect(rows?.[1]?.depth).toBe(1)
  })

  it('re-pulls every source on locale changes', () => {
    const registry = new RegViewRegistry()
    let label = 'First'
    registry.register(source({
      label: () => label,
      getSnapshot: () => ready([{ id: 'r1', cells: { name: label } }]),
    }))
    label = 'Second'
    registry.repull()
    expect(registry.snapshots.getSnapshot().get('test')?.rows[0]?.cells.name).toBe('Second')
  })
})
