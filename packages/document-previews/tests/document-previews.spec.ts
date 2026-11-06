import { describe, expect, it, vi } from 'vitest'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { RegViewSource } from '@dsh-regview/core/client'
import { apply, inject } from '../src/client/index.ts'
import { en, zh, type RegViewKey } from '../src/client/locales.ts'
import {
  createDocumentPreviewsSource,
  DOCUMENT_PREVIEWS_SOURCE_ID,
  DOCUMENT_PREVIEWS_SOURCE_ORDER,
  ownerOf,
} from '../src/client/source.ts'
import type { InspectorRow } from '../src/client/source.ts'

/** Build a namespace-bound translate function over one dictionary. */
function translator(dict: Record<string, string> = zh): (key: RegViewKey) => string {
  return key => dict[key] ?? key
}

/** Build one fake preview definition with sensible defaults. */
function definition(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/markdown',
    extensions: ['md', 'markdown'],
    binaryExtensions: [],
    priority: 'extension',
    loading: 'text-pages',
    wrap: false,
    title: () => 'ignored title',
    ...overrides,
  }
}

/** Build a fake `ctx.documentPreviews` registry around a definition list. */
function registry(definitions: readonly unknown[]): { getSnapshot: () => readonly unknown[] } {
  return { getSnapshot: () => definitions }
}

/** Find one row by id, failing the test when it is missing. */
function row(rows: readonly InspectorRow[], id: string): InspectorRow {
  const found = rows.find(candidate => candidate.id === id)
  if (found === undefined) throw new Error(`missing row ${id}`)
  return found
}

/** Read one detail value by its localized label. */
function detail(rowValue: InspectorRow, label: string): string | undefined {
  return rowValue.details?.find(item => item.label === label)?.value
}

describe('ownerOf', () => {
  it('takes the part before the last slash', () => {
    expect(ownerOf('@deepseek-ai/dsh-client-ui-sidebar-documentpreview/markdown'))
      .toBe('@deepseek-ai/dsh-client-ui-sidebar-documentpreview')
    expect(ownerOf('a/b/c')).toBe('a/b')
  })

  it('returns the whole id when it has no slash', () => {
    expect(ownerOf('plain-implementation')).toBe('plain-implementation')
  })
})

describe('createDocumentPreviewsSource', () => {
  it('declares the id, extensions, binary, priority, loading, and wrap columns', () => {
    const source = createDocumentPreviewsSource(registry([]), translator())
    expect(source.id).toBe(DOCUMENT_PREVIEWS_SOURCE_ID)
    expect(source.order).toBe(DOCUMENT_PREVIEWS_SOURCE_ORDER)
    expect(source.columns.map(column => column.key)).toEqual([
      'id', 'extensions', 'binary', 'priority', 'loading', 'wrap',
    ])
    expect(source.columns.map(column => column.label())).toEqual([
      '实现 ID', '扩展名', '二进制后缀', '优先级', '加载方式', '折行',
    ])
    expect(source.columns[0]?.mono).toBe(true)
    expect(source.label()).toBe('文档预览')
    expect(source.description?.()).toBe(zh['section.description'])
  })

  it('turns each definition into a row with an inferred owner detail', () => {
    const source = createDocumentPreviewsSource(registry([
      definition({ binaryExtensions: ['png', 'zip'] }),
    ]), translator())
    const snapshot = source.getSnapshot()
    expect(snapshot.status).toBe('ready')
    expect(snapshot.note).toBe(zh['note'])
    expect(row(snapshot.rows, '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/markdown').cells).toEqual({
      id: '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/markdown',
      extensions: 'md, markdown',
      binary: 'png, zip',
      priority: 'extension',
      loading: 'text-pages',
      wrap: '否',
    })
    expect(detail(row(snapshot.rows, '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/markdown'), '注册方（推断）'))
      .toBe('@deepseek-ai/dsh-client-ui-sidebar-documentpreview')
  })

  it('fills defaults for an absent priority, loading, and wrap', () => {
    const source = createDocumentPreviewsSource(registry([
      { id: 'minimal' },
      definition({ id: 'wrapped', priority: 'builtin', wrap: true }),
    ]), translator())
    const rows = source.getSnapshot().rows
    expect(row(rows, 'minimal').cells).toMatchObject({
      priority: 'extension',
      loading: '—',
      extensions: '—',
      binary: '—',
      wrap: '否',
    })
    expect(row(rows, 'wrapped').cells.priority).toBe('builtin')
    expect(row(rows, 'wrapped').cells.wrap).toBe('是')
  })

  it('localizes the wrap cells in English', () => {
    const source = createDocumentPreviewsSource(registry([
      definition({ id: 'a/on', wrap: true }),
      definition({ id: 'a/off', wrap: false }),
    ]), translator(en))
    const rows = source.getSnapshot().rows
    expect(row(rows, 'a/on').cells.wrap).toBe('Yes')
    expect(row(rows, 'a/off').cells.wrap).toBe('No')
    expect(source.getSnapshot().note).toBe(en['note'])
  })

  it('never calls a definition title thunk', () => {
    const title = vi.fn(() => 'never called')
    const source = createDocumentPreviewsSource(registry([definition({ title })]), translator())
    expect(source.getSnapshot().rows).toHaveLength(1)
    expect(title).not.toHaveBeenCalled()
  })

  it('lists the full id, priority, loading, wrap, and binary list as details', () => {
    const source = createDocumentPreviewsSource(registry([
      definition({ binaryExtensions: ['png'], priority: 'builtin', wrap: true }),
    ]), translator())
    const markdown = row(source.getSnapshot().rows, '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/markdown')
    expect(detail(markdown, '完整实现 ID')).toBe('@deepseek-ai/dsh-client-ui-sidebar-documentpreview/markdown')
    expect(detail(markdown, '优先级')).toBe('builtin')
    expect(detail(markdown, '加载方式')).toBe('text-pages')
    expect(detail(markdown, '折行')).toBe('是')
    expect(detail(markdown, '二进制后缀')).toBe('png')
  })

  it('skips entries without a usable id and reports an empty list as ready', () => {
    const source = createDocumentPreviewsSource(registry([{ extensions: ['md'] }, 'junk']), translator())
    const snapshot = source.getSnapshot()
    expect(snapshot.status).toBe('ready')
    expect(snapshot.rows).toEqual([])
    expect(snapshot.note).toBe(zh['note'])
  })

  it('turns a throwing registry read into an error snapshot instead of throwing', () => {
    const source = createDocumentPreviewsSource({
      getSnapshot: () => { throw new Error('registry exploded') },
    }, translator())
    expect(() => source.getSnapshot()).not.toThrow()
    const snapshot = source.getSnapshot()
    expect(snapshot.status).toBe('error')
    expect(snapshot.rows).toEqual([])
    expect(snapshot.error).toBe('registry exploded')
  })

  it.each([
    ['a non-array snapshot', { getSnapshot: () => ({}) }, /did not return an array/],
    ['a null service', null, /is not an object/],
    ['a service without getSnapshot', {}, /getSnapshot is not a function/],
  ])('reports %s as an error snapshot', (_name, service, message) => {
    const source = createDocumentPreviewsSource(service, translator())
    expect(() => source.getSnapshot()).not.toThrow()
    const snapshot = source.getSnapshot()
    expect(snapshot.status).toBe('error')
    expect(snapshot.error).toMatch(message)
  })

  it('forwards subscriptions to the live registry', () => {
    let notify: (() => void) | undefined
    const dispose = vi.fn()
    const subscribe = vi.fn((listener: () => void) => {
      notify = listener
      return dispose
    })
    const source = createDocumentPreviewsSource({ getSnapshot: () => [], subscribe }, translator())
    const listener = vi.fn()
    const unsubscribe = source.subscribe?.(listener)
    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(subscribe).toHaveBeenCalledWith(listener)
    expect(unsubscribe).toBe(dispose)
    notify?.()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('reports a missing subscribe as a diagnostic', () => {
    const source = createDocumentPreviewsSource(registry([]), translator())
    expect(() => source.subscribe?.(() => {})).toThrow(/subscribe is not a function/)
  })

  it('is structurally compatible with the core inspector contract', () => {
    const source: RegViewSource = createDocumentPreviewsSource(registry([]), translator())
    expect(source.id).toBe(DOCUMENT_PREVIEWS_SOURCE_ID)
  })
})

describe('apply', () => {
  it('registers the dictionaries and one source through ctx.effect', () => {
    const registered: RegViewSource[] = []
    const effects: string[] = []
    const localeRegister = vi.fn((_ns: string, _dicts: Record<'zh' | 'en', Record<string, string>>) => () => {})
    const definitions = [definition()]
    const fake = {
      regview: {
        register: (source: RegViewSource) => {
          registered.push(source)
          return () => {}
        },
      },
      documentPreviews: {
        getSnapshot: () => definitions,
        subscribe: () => () => {},
      },
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

    expect(inject).toEqual(['regview', 'documentPreviews', 'locale'])
    expect(effects).toEqual(['regview.documentPreviews: dictionaries', 'regview.documentPreviews: source'])
    expect(localeRegister).toHaveBeenCalledTimes(1)
    expect(localeRegister.mock.calls[0]?.[0]).toBe('regview.documentPreviews')
    expect(localeRegister.mock.calls[0]?.[1]).toEqual({ zh, en })
    expect(registered).toHaveLength(1)
    expect(registered[0]?.id).toBe(DOCUMENT_PREVIEWS_SOURCE_ID)
    expect(registered[0]?.getSnapshot().rows).toHaveLength(1)
  })
})
