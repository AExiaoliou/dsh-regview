import { describe, expect, it, vi } from 'vitest'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { RegViewSource } from '@dsh-regview/core/client'
import { apply, inject } from '../src/client/index.ts'
import { en, zh, type RegViewKey } from '../src/client/locales.ts'
import {
  createSidebarTabsSource,
  readSidebarTabsSnapshot,
  SIDEBAR_TABS_SOURCE_ID,
  SIDEBAR_TABS_SOURCE_ORDER,
  sidebarTabsColumns,
} from '../src/client/source.ts'
import type { InspectorRow, TabDefinition, TabRegistry } from '../src/client/source.ts'

/** Build a namespace-bound translate function over one dictionary. */
function translator(dict: Record<string, string> = zh): (key: RegViewKey) => string {
  return key => dict[key] ?? key
}

/** Build a fake tab registry handing back fixed definitions. */
function registryOf(definitions: readonly TabDefinition[]): TabRegistry {
  return { entries: () => definitions, subscribe: () => () => {} }
}

/** Find one row by kind, failing the test when it is missing. */
function row(rows: readonly InspectorRow[], id: string): InspectorRow {
  const found = rows.find(candidate => candidate.id === id)
  if (found === undefined) throw new Error(`missing row ${id}`)
  return found
}

/** Read one detail value by its localized label. */
function detail(rowValue: InspectorRow, label: string): string | undefined {
  return rowValue.details?.find(item => item.label === label)?.value
}

describe('sidebarTabsColumns', () => {
  it('declares the kind, id, priority, patterns, and guide-count columns', () => {
    const columns = sidebarTabsColumns(translator())
    expect(columns.map(column => column.key)).toEqual(['kind', 'id', 'priority', 'patterns', 'guides'])
    expect(columns.map(column => column.label())).toEqual(['类型', '实现 ID', '优先级', '地址模式', '引导项'])
    expect(columns.map(column => column.mono)).toEqual([true, true, undefined, true, undefined])
  })
})

describe('createSidebarTabsSource', () => {
  it('declares its identity, order, category copy, and subscription', () => {
    const source = createSidebarTabsSource(registryOf([]), translator())
    expect(source.id).toBe(SIDEBAR_TABS_SOURCE_ID)
    expect(source.order).toBe(SIDEBAR_TABS_SOURCE_ORDER)
    expect(source.label()).toBe(zh['section.label'])
    expect(source.description?.()).toBe(zh['section.description'])
    expect(source.subscribe).toBeTypeOf('function')
  })

  it('maps a bare definition into a row with extension/no defaults', () => {
    const source = createSidebarTabsSource(registryOf([
      { kind: 'guide', id: 'ui-sidebar-right.guide' },
    ]), translator())
    const snapshot = source.getSnapshot()
    expect(snapshot.status).toBe('ready')
    expect(snapshot.note).toBe(zh['note'])
    const guide = row(snapshot.rows, 'guide')
    expect(guide.cells).toEqual({
      kind: 'guide',
      id: 'ui-sidebar-right.guide',
      priority: 'extension',
      patterns: '—',
      guides: '0',
    })
    expect(guide.details).toEqual([
      { label: '多开', value: '否' },
      { label: '保持挂载', value: '否' },
      { label: 'canOpen 谓词', value: '否' },
    ])
  })

  it('exposes declared flags, patterns, and guide entries as details', () => {
    const source = createSidebarTabsSource(registryOf([
      {
        kind: 'markdown',
        id: 'builtin.markdown',
        priority: 'builtin',
        multiple: true,
        keepMounted: true,
        patterns: ['*.md', 'dsh-resource://file/**'],
        canOpen: () => true,
        guide: [
          { id: 'notes', title: () => '笔记', description: () => '打开笔记' },
          { id: 'plain', title: () => '纯文本' },
        ],
      },
    ]), translator())
    const markdown = row(source.getSnapshot().rows, 'markdown')
    expect(markdown.cells).toEqual({
      kind: 'markdown',
      id: 'builtin.markdown',
      priority: 'builtin',
      patterns: '*.md, dsh-resource://file/**',
      guides: '2',
    })
    expect(detail(markdown, '多开')).toBe('是')
    expect(detail(markdown, '保持挂载')).toBe('是')
    expect(detail(markdown, 'canOpen 谓词')).toBe('是')
    expect(markdown.details?.filter(item => item.label === '匹配模式').map(item => item.value))
      .toEqual(['*.md', 'dsh-resource://file/**'])
    expect(detail(markdown, '笔记')).toBe('打开笔记')
    expect(detail(markdown, '纯文本')).toBe('—')
  })

  it('never calls the address-dependent definition title()', () => {
    const title = vi.fn(() => 'Guide')
    const definition = { kind: 'guide', id: 'ui-sidebar-right.guide', title }
    const source = createSidebarTabsSource(registryOf([definition]), translator())
    expect(source.getSnapshot().status).toBe('ready')
    expect(title).not.toHaveBeenCalled()
  })

  it('resolves guide title and description thunks defensively', () => {
    const source = createSidebarTabsSource(registryOf([
      {
        kind: 'broken',
        id: 'broken.type',
        guide: [
          { id: 'throwing', title: () => { throw new Error('title boom') }, description: () => { throw new Error('desc boom') } },
          { id: 'empty', title: () => '', description: () => '' },
        ],
      },
    ]), translator())
    const broken = row(source.getSnapshot().rows, 'broken')
    expect(detail(broken, 'throwing')).toBe('—')
    expect(detail(broken, 'empty')).toBe('—')
  })

  it('re-evaluates localized thunks on every read', () => {
    let dict: Record<string, string> = zh
    const t = (key: RegViewKey): string => dict[key] ?? key
    const source = createSidebarTabsSource(registryOf([
      { kind: 'guide', id: 'ui-sidebar-right.guide', guide: [{ id: 'notes', title: () => t('detail.pattern') }] },
    ]), t)
    expect(source.label()).toBe(zh['section.label'])
    expect(source.getSnapshot().note).toBe(zh['note'])
    dict = en
    expect(source.label()).toBe(en['section.label'])
    expect(source.getSnapshot().note).toBe(en['note'])
    expect(source.columns[0]?.label()).toBe(en['column.kind'])
    expect(detail(row(source.getSnapshot().rows, 'guide'), en['detail.pattern'])).toBe('—')
  })

  it('forwards subscriptions to the tab registry and returns its disposer', () => {
    let notify: (() => void) | undefined
    const listener = vi.fn()
    const unsubscribe = vi.fn()
    const source = createSidebarTabsSource({
      entries: () => [],
      subscribe: (fn) => {
        notify = fn
        return unsubscribe
      },
    }, translator())
    const release = source.subscribe?.(listener)
    expect(release).toBe(unsubscribe)
    notify?.()
    expect(listener).toHaveBeenCalledTimes(1)
    release?.()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('turns a throwing entries() into an error snapshot instead of throwing', () => {
    const source = createSidebarTabsSource({
      entries: () => { throw new Error('registry exploded') },
      subscribe: () => () => {},
    }, translator())
    expect(() => source.getSnapshot()).not.toThrow()
    const snapshot = source.getSnapshot()
    expect(snapshot.status).toBe('error')
    expect(snapshot.rows).toEqual([])
    expect(snapshot.error).toMatch(/registry exploded/)
  })

  it('is structurally compatible with the core inspector contract', () => {
    const source: RegViewSource = createSidebarTabsSource(registryOf([]), translator())
    expect(source.id).toBe(SIDEBAR_TABS_SOURCE_ID)
  })
})

describe('readSidebarTabsSnapshot', () => {
  it('reads without a full client context', () => {
    const snapshot = readSidebarTabsSnapshot(registryOf([{ kind: 'a', id: 'a.impl' }]), translator())
    expect(snapshot.status).toBe('ready')
    expect(snapshot.rows.map(value => value.id)).toEqual(['a'])
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
      sidebarRightTabs: registryOf([{ kind: 'guide', id: 'ui-sidebar-right.guide' }]),
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

    expect(inject).toEqual(['regview', 'sidebarRightTabs', 'locale'])
    expect(effects).toEqual(['regview.sidebarTabs: dictionaries', 'regview.sidebarTabs: category'])
    expect(localeRegister).toHaveBeenCalledTimes(1)
    expect(localeRegister.mock.calls[0]?.[0]).toBe('regview.sidebarTabs')
    expect(localeRegister.mock.calls[0]?.[1]).toEqual({ zh, en })
    expect(registered).toHaveLength(1)
    expect(registered[0]?.id).toBe(SIDEBAR_TABS_SOURCE_ID)
    expect(registered[0]?.getSnapshot().rows).toHaveLength(1)
  })
})
