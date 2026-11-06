import { describe, expect, it, vi } from 'vitest'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { RegViewSource } from '@dsh-regview/core/client'
import { apply, inject } from '../src/client/index.ts'
import { en, zh, type RegViewKey } from '../src/client/locales.ts'
import {
  createResourcesSource,
  extractProviders,
  readResourcesSnapshot,
  RESOURCES_SOURCE_ID,
  RESOURCES_SOURCE_ORDER,
} from '../src/client/source.ts'
import type { InspectorRow } from '../src/client/source.ts'

/** Build a namespace-bound translate function over one dictionary. */
function translator(dict: Record<string, string> = zh): (key: RegViewKey) => string {
  return key => dict[key] ?? key
}

/** Build a fake `ctx.resources` whose private provider table is a Map. */
function table(entries: ReadonlyArray<readonly [string, unknown]>): { providers: Map<string, unknown> } {
  return { providers: new Map(entries) }
}

/** Find one row by protocol, failing the test when it is missing. */
function row(rows: readonly InspectorRow[], id: string): InspectorRow {
  const found = rows.find(candidate => candidate.id === id)
  if (found === undefined) throw new Error(`missing row ${id}`)
  return found
}

/** Read one detail value by its localized label. */
function detail(rowValue: InspectorRow, label: string): string | undefined {
  return rowValue.details?.find(item => item.label === label)?.value
}

describe('extractProviders', () => {
  it('keeps map values with a string protocol and sorts them by protocol', () => {
    const entries = extractProviders(table([
      ['zeta', { protocol: 'zeta', open: () => {} }],
      ['invalid', { open: () => {} }],
      ['alpha', { protocol: 'alpha', open: () => {} }],
    ]))
    expect(entries.map(entry => entry.protocol)).toEqual(['alpha', 'zeta'])
  })

  it('records the 1-based registration order from the provider table', () => {
    const entries = extractProviders(table([
      ['zeta', { protocol: 'zeta' }],
      ['alpha', { protocol: 'alpha' }],
    ]))
    expect(entries.map(entry => [entry.protocol, entry.registrationOrder])).toEqual([
      ['alpha', 2],
      ['zeta', 1],
    ])
  })

  it('throws a diagnostic when the provider table is not a Map', () => {
    expect(() => extractProviders({ providers: [] })).toThrow(/providers is not a Map/)
    expect(() => extractProviders(undefined)).toThrow(/providers is not a Map/)
  })
})

describe('createResourcesSource', () => {
  it('declares the protocol, registrant, and address columns', () => {
    const source = createResourcesSource(table([]), translator())
    expect(source.id).toBe(RESOURCES_SOURCE_ID)
    expect(source.order).toBe(RESOURCES_SOURCE_ORDER)
    expect(source.columns.map(column => column.key)).toEqual(['protocol', 'registrant', 'address'])
    expect(source.columns.map(column => column.label())).toEqual(['协议', '注册方', '地址'])
    expect(source.columns[0]?.mono).toBe(true)
    expect(source.columns[2]?.mono).toBe(true)
    expect(source.label()).toBe('资源协议')
    expect(source.description?.()).toBe(zh['section.description'])
    expect(source.subscribe).toBeUndefined()
  })

  it('turns each provider into a row keyed by protocol with a dsh-resource address', () => {
    const source = createResourcesSource(table([
      ['file', { protocol: 'file', open: () => {} }],
    ]), translator())
    const snapshot = source.getSnapshot()
    expect(snapshot.status).toBe('ready')
    expect(snapshot.note).toBe(zh['note'])
    const fileRow = row(snapshot.rows, 'file')
    expect(fileRow.cells).toEqual({
      protocol: 'file',
      registrant: '@deepseek-ai/dsh-api-workspace-files（内置推断）',
      address: 'dsh-resource://file/…',
    })
  })

  it('appends the localized built-in hint for the known protocols', () => {
    const source = createResourcesSource(table([
      ['file', { protocol: 'file', open: () => {} }],
      ['subagentchat', { protocol: 'subagentchat', open: () => {} }],
      ['plan', { protocol: 'plan', open: () => {} }],
      ['custom', { protocol: 'custom', open: () => {} }],
    ]), translator())
    const rows = source.getSnapshot().rows
    expect(row(rows, 'file').cells.registrant).toBe('@deepseek-ai/dsh-api-workspace-files（内置推断）')
    expect(row(rows, 'subagentchat').cells.registrant).toBe('@deepseek-ai/dsh-client-ui-subagent（内置推断）')
    expect(row(rows, 'plan').cells.registrant).toBe('@deepseek-ai/dsh-client-ui-plan（内置推断）')
    expect(row(rows, 'custom').cells.registrant).toBe('未公开')
  })

  it('localizes the hint suffix and the unknown registrant in English', () => {
    const source = createResourcesSource(table([
      ['file', { protocol: 'file', open: () => {} }],
      ['custom', { protocol: 'custom', open: () => {} }],
    ]), translator(en))
    const rows = source.getSnapshot().rows
    expect(row(rows, 'file').cells.registrant).toBe('@deepseek-ai/dsh-api-workspace-files (built-in hint)')
    expect(row(rows, 'custom').cells.registrant).toBe('Not exposed')
    expect(source.getSnapshot().note).toBe(en['note'])
  })

  it('describes provider.open by type without calling it', () => {
    const open = vi.fn(() => 'never opened')
    const source = createResourcesSource(table([
      ['file', { protocol: 'file', open }],
      ['plan', { protocol: 'plan' }],
      ['chat', { protocol: 'chat', open: 'not-callable' }],
    ]), translator())
    const rows = source.getSnapshot().rows
    expect(detail(row(rows, 'file'), 'provider.open 类型')).toBe('function open(address, ctx)')
    expect(detail(row(rows, 'plan'), 'provider.open 类型')).toBe('undefined')
    expect(detail(row(rows, 'chat'), 'provider.open 类型')).toBe('string')
    expect(open).not.toHaveBeenCalled()
  })

  it('lists registration order and the address example as details', () => {
    const source = createResourcesSource(table([
      ['file', { protocol: 'file', open: () => {} }],
      ['plan', { protocol: 'plan', open: () => {} }],
    ]), translator())
    const rows = source.getSnapshot().rows
    expect(detail(row(rows, 'file'), '注册顺序')).toBe('1')
    expect(detail(row(rows, 'plan'), '注册顺序')).toBe('2')
    expect(detail(row(rows, 'plan'), '地址示例')).toBe('dsh-resource://plan/…')
  })

  it('reports an empty provider table as a ready, empty snapshot with a note', () => {
    const snapshot = createResourcesSource(table([]), translator()).getSnapshot()
    expect(snapshot.status).toBe('ready')
    expect(snapshot.rows).toEqual([])
    expect(snapshot.note).toBe(zh['note'])
  })

  it.each([
    ['a missing table', {}],
    ['an array table', { providers: [] }],
    ['a string table', { providers: 'nope' }],
    ['a null service', null],
    ['an undefined service', undefined],
  ])('turns %s into an error snapshot instead of throwing', (_name, resources) => {
    const source = createResourcesSource(resources, translator())
    expect(() => source.getSnapshot()).not.toThrow()
    const snapshot = source.getSnapshot()
    expect(snapshot.status).toBe('error')
    expect(snapshot.rows).toEqual([])
    expect(snapshot.error).toMatch(/providers is not a Map/)
  })

  it('is structurally compatible with the core inspector contract', () => {
    const source: RegViewSource = createResourcesSource(table([]), translator())
    expect(source.id).toBe(RESOURCES_SOURCE_ID)
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
      resources: table([['file', { protocol: 'file', open: () => {} }]]),
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

    expect(inject).toEqual(['regview', 'resources', 'locale'])
    expect(effects).toEqual(['regview.resources: dictionaries', 'regview.resources: source'])
    expect(localeRegister).toHaveBeenCalledTimes(1)
    expect(localeRegister.mock.calls[0]?.[0]).toBe('regview.resources')
    expect(localeRegister.mock.calls[0]?.[1]).toEqual({ zh, en })
    expect(registered).toHaveLength(1)
    expect(registered[0]?.id).toBe(RESOURCES_SOURCE_ID)
    expect(registered[0]?.getSnapshot().rows).toHaveLength(1)
  })
})

describe('readResourcesSnapshot', () => {
  it('reads without a full client context', () => {
    const snapshot = readResourcesSnapshot(table([['file', { protocol: 'file', open: () => {} }]]), translator())
    expect(snapshot.status).toBe('ready')
    expect(snapshot.rows.map(value => value.id)).toEqual(['file'])
  })
})
