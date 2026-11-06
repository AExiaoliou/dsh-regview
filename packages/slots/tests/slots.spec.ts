import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { RegViewSource } from '@dsh-regview/core/client'
import { apply, inject } from '../src/client/index.ts'
import { en, zh, type RegViewKey } from '../src/client/locales.ts'
import {
  createSlotsSource, EMPTY_CELL, flattenNodes, readSlotsSnapshot, SLOTS_POLL_INTERVAL_MS,
  SLOTS_SOURCE_ID, SLOTS_SOURCE_ORDER, type LiveNode, type SlotsHost, type SlotsTranslate,
} from '../src/client/source.ts'
import type { InspectorRow } from '../src/client/source.ts'

/** Build a namespace-bound translate function over one dictionary. */
function translator(dict: Record<string, string> = en): SlotsTranslate {
  return (key: RegViewKey, params?: Record<string, unknown>) => {
    let text = dict[key] ?? key
    if (params === undefined) return text
    for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value))
    return text
  }
}

/** Build one slot node with sensible defaults. */
function slot(name: string, overrides: Partial<LiveNode> = {}): LiveNode {
  return { type: 'slot', name, kind: 'single', scope: 'root', occupants: [], children: [], ...overrides }
}

/** Build one factory node with sensible defaults. */
function factory(name: string, overrides: Partial<LiveNode> = {}): LiveNode {
  return { type: 'factory', name, scope: 'session', children: [], ...overrides }
}

/** A host whose tree and read count the test controls. */
function fakeHost(initial: readonly LiveNode[]): { host: SlotsHost; set(next: readonly LiveNode[]): void; reads(): number } {
  let tree: readonly LiveNode[] = initial
  let reads = 0
  const host: SlotsHost = {
    snapshot: () => {
      reads += 1
      return tree
    },
  }
  return {
    host,
    set(next: readonly LiveNode[]): void { tree = next },
    reads(): number { return reads },
  }
}

/** Find one row by id, failing the test when it is missing. */
function row(rows: readonly InspectorRow[], id: string): InspectorRow {
  const found = rows.find(candidate => candidate.id === id)
  if (found === undefined) throw new Error(`missing row ${id}`)
  return found
}

describe('flattenNodes', () => {
  it('flattens nested slot trees depth-first and keeps source order', () => {
    const tree: readonly LiveNode[] = [
      slot('root', {
        declaredBy: 'framework',
        occupants: [{ registrant: '@dsh/ui-layout', priority: 0, active: true }],
        children: [
          slot('sidebar', {
            kind: 'list',
            declaredBy: '@dsh/ui-layout',
            children: [
              slot('sidebar.panellist', {
                kind: 'list',
                declaredBy: '@dsh/ui-layout',
                occupants: [{ id: 'regview', order: 90, priority: 0, active: true }],
              }),
            ],
          }),
        ],
      }),
    ]

    const rows = flattenNodes(tree, translator())

    expect(rows.map(value => value.id)).toEqual(['root', 'sidebar', 'sidebar.panellist'])
    expect(rows.map(value => value.cells.kind)).toEqual(['single', 'list', 'list'])
    expect(rows.map(value => value.cells.occupants)).toEqual(['1', '0', '1'])
    expect(rows.map(value => value.depth ?? 0)).toEqual([0, 1, 2])
    expect(rows.map(value => value.hasChildren === true)).toEqual([true, true, false])
    expect(row(rows, 'root').cells).toMatchObject({
      key: 'root',
      scope: 'root',
      declaredBy: 'framework',
      occupants: '1',
    })
    expect(row(rows, 'root').details).toContainEqual({ label: 'Children', value: '1' })
    expect(row(rows, 'sidebar.panellist').details).toContainEqual({
      label: 'Occupant 1',
      value: 'id=regview, order=90, priority=0, active=active',
    })
  })

  it('renders factory rows with a factory key, registrant detail, and nested children', () => {
    const tree: readonly LiveNode[] = [
      factory('conversation.item', {
        registrant: '@dsh/ui-conversation',
        children: [
          slot('conversation.item.tools', {
            kind: 'list',
            scope: 'session',
            declaredBy: '@dsh/ui-conversation',
            occupants: [{ id: 'tools', priority: 0, active: true }],
          }),
        ],
      }),
    ]

    const rows = flattenNodes(tree, translator())

    expect(rows.map(value => value.id)).toEqual(['factory:conversation.item', 'conversation.item.tools'])
    expect(row(rows, 'factory:conversation.item').cells).toMatchObject({
      key: 'factory:conversation.item',
      kind: 'factory',
      scope: 'session',
      declaredBy: EMPTY_CELL,
      occupants: '0',
    })
    expect(row(rows, 'factory:conversation.item').details).toContainEqual({ label: 'Children', value: '1' })
    expect(row(rows, 'factory:conversation.item').details).toContainEqual({
      label: 'Registrant',
      value: '@dsh/ui-conversation',
    })
    expect(row(rows, 'conversation.item.tools').cells).toMatchObject({
      kind: 'list',
      scope: 'session',
      declaredBy: '@dsh/ui-conversation',
    })
  })

  it('formats occupant details and omits absent fields', () => {
    const rows = flattenNodes([slot('root', {
      occupants: [
        { registrant: '@acme/plugin', key: 'primary', id: 'item', order: 2, priority: 1, active: false },
        { active: true },
        {},
      ],
    })], translator())

    expect(row(rows, 'root').details).toContainEqual({
      label: 'Occupant 1',
      value: 'registrant=@acme/plugin, key=primary, id=item, order=2, priority=1, active=inactive',
    })
    expect(row(rows, 'root').details).toContainEqual({ label: 'Occupant 2', value: 'active=active' })
    expect(row(rows, 'root').details).toContainEqual({ label: 'Occupant 3', value: EMPTY_CELL })
  })

  it('uses the em dash for unknown declarers and factories without a registrant', () => {
    const rows = flattenNodes([slot('root'), factory('plain')], translator())

    expect(row(rows, 'root').cells.declaredBy).toBe(EMPTY_CELL)
    expect(row(rows, 'factory:plain').details).toContainEqual({ label: 'Registrant', value: EMPTY_CELL })
  })

  it('localizes through the zh dictionary', () => {
    const rows = flattenNodes([slot('root', { occupants: [{ active: false }] })], translator(zh))

    expect(row(rows, 'root').details).toContainEqual({ label: '子项', value: '0' })
    expect(row(rows, 'root').details).toContainEqual({ label: '占用项 1', value: 'active=未激活' })
  })

  it('does not cap rows because the core registry owns the 1000-row ceiling', () => {
    const tree = Array.from({ length: 1050 }, (_, index) => slot(`slot-${index}`))
    const snapshot = createSlotsSource(fakeHost(tree).host, translator()).getSnapshot()

    expect(snapshot.status).toBe('ready')
    expect(snapshot.rows).toHaveLength(1050)
    expect(snapshot.truncated).toBeUndefined()
  })

  it('is structurally compatible with the core inspector contract', () => {
    const source: RegViewSource = createSlotsSource(fakeHost([slot('root')]).host, translator())
    expect(source.id).toBe(SLOTS_SOURCE_ID)
  })
})

describe('readSlotsSnapshot', () => {
  it('converts a host read failure into an error snapshot, then recovers on the next read', () => {
    let fail = true
    const host: SlotsHost = {
      snapshot: () => {
        if (fail) throw new Error('boom')
        return [slot('root')]
      },
    }
    const source = createSlotsSource(host, translator())

    const failed = source.getSnapshot()
    expect(failed.status).toBe('error')
    expect(failed.rows).toEqual([])
    expect(failed.error).toContain('boom')
    expect(failed.note).toContain('1.5s')

    fail = false
    expect(source.getSnapshot().status).toBe('ready')
  })

  it('reads without a full client context', () => {
    const snapshot = readSlotsSnapshot(fakeHost([slot('root')]).host, translator())
    expect(snapshot.status).toBe('ready')
    expect(snapshot.rows.map(value => value.id)).toEqual(['root'])
  })

  it('exposes the localized category metadata, columns, and note', () => {
    const source = createSlotsSource(fakeHost([slot('root')]).host, translator())

    expect(source.id).toBe(SLOTS_SOURCE_ID)
    expect(source.order).toBe(SLOTS_SOURCE_ORDER)
    expect(source.label()).toBe('Slots')
    expect(source.description?.()).toContain('Slot')
    expect(source.tree).toBe(true)
    expect(source.columns.map(column => column.key)).toEqual(['key', 'kind', 'scope', 'declaredBy', 'occupants'])
    expect(source.columns[0]?.mono).toBe(true)
    expect(source.columns.map(column => column.label())).toEqual(['Key', 'Kind', 'Scope', 'Declared by', 'Occupants'])
    expect(source.getSnapshot().note).toContain('1.5s')
  })
})

describe('polling', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('starts one interval for the first subscriber and stops it after the last', () => {
    const source = createSlotsSource(fakeHost([slot('root')]).host, translator())

    expect(vi.getTimerCount()).toBe(0)
    const releaseFirst = source.subscribe(() => {})
    expect(vi.getTimerCount()).toBe(1)
    const releaseSecond = source.subscribe(() => {})
    expect(vi.getTimerCount()).toBe(1)

    releaseFirst()
    expect(vi.getTimerCount()).toBe(1)
    releaseSecond()
    expect(vi.getTimerCount()).toBe(0)

    releaseSecond()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('polls every 1.5s and notifies only when the serialized snapshot changes', () => {
    const fake = fakeHost([slot('root')])
    const source = createSlotsSource(fake.host, translator())
    source.getSnapshot()
    const readsBefore = fake.reads()
    const listener = vi.fn()
    const release = source.subscribe(listener)

    vi.advanceTimersByTime(SLOTS_POLL_INTERVAL_MS - 1)
    expect(fake.reads()).toBe(readsBefore)
    vi.advanceTimersByTime(1)
    expect(fake.reads()).toBe(readsBefore + 1)
    expect(listener).not.toHaveBeenCalled()

    fake.set([slot('root', { declaredBy: '@acme/plugin' })])
    vi.advanceTimersByTime(SLOTS_POLL_INTERVAL_MS)
    expect(listener).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(SLOTS_POLL_INTERVAL_MS)
    expect(listener).toHaveBeenCalledTimes(1)

    release()
  })

  it('initializes its cache lazily before the first read', () => {
    const fake = fakeHost([slot('root')])
    const source = createSlotsSource(fake.host, translator())

    expect(fake.reads()).toBe(0)
    expect(source.getSnapshot().status).toBe('ready')
    expect(fake.reads()).toBe(1)
  })

  it('forces a read and notifies on change when refresh is called', () => {
    const fake = fakeHost([slot('root')])
    const source = createSlotsSource(fake.host, translator())
    source.getSnapshot()
    const listener = vi.fn()
    const release = source.subscribe(listener)

    source.refresh()
    expect(listener).not.toHaveBeenCalled()

    fake.set([slot('root', { declaredBy: '@acme/plugin' })])
    source.refresh()
    expect(listener).toHaveBeenCalledTimes(1)

    release()
  })
})

describe('apply', () => {
  it('registers the dictionaries and one source through ctx.effect', () => {
    const registered: RegViewSource[] = []
    const effects: string[] = []
    const localeRegister = vi.fn((_ns: string, _dicts: Record<'zh' | 'en', Record<string, string>>) => () => {})
    const fake = {
      regview: {
        register: (source: RegViewSource) => {
          registered.push(source)
          return () => {}
        },
      },
      slots: fakeHost([slot('root', { declaredBy: 'framework' })]).host,
      locale: {
        register: localeRegister,
        bind: () => translator(),
      },
      effect: (body: () => (() => void) | void, label: string) => {
        effects.push(label)
        body()
      },
    }

    apply(fake as unknown as ClientContext)

    expect(inject).toEqual(['regview', 'slots', 'locale'])
    expect(effects).toEqual(['regview.slots: dictionaries', 'regview.slots: source'])
    expect(localeRegister).toHaveBeenCalledTimes(1)
    expect(localeRegister.mock.calls[0]?.[0]).toBe('regview.slots')
    expect(localeRegister.mock.calls[0]?.[1]).toEqual({ zh, en })
    expect(registered).toHaveLength(1)
    expect(registered[0]?.id).toBe(SLOTS_SOURCE_ID)
    expect(registered[0]?.getSnapshot().rows.map(value => value.id)).toEqual(['root'])
  })
})
