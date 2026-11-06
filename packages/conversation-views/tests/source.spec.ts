import { describe, expect, it, vi } from 'vitest'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { RegViewSource } from '@aexiaoliou/dsh-regview-core/client'
import { apply, inject } from '../src/client/index.ts'
import { en, zh, type RegViewKey } from '../src/client/locales.ts'
import {
  CONVERSATION_VIEW_SLOT,
  CONVERSATION_VIEWS_SOURCE_ID,
  CONVERSATION_VIEWS_SOURCE_ORDER,
  conversationViewsColumns,
  createConversationViewsSource,
  readConversationViewsSnapshot,
} from '../src/client/source.ts'
import type {
  ConversationViewEntry,
  ConversationViewSlots,
  InspectorRow,
} from '../src/client/source.ts'

/** Build a namespace-bound translate function over one dictionary. */
function translator(dict: Record<string, string> = zh): (key: RegViewKey) => string {
  return key => dict[key] ?? key
}

/** Build a fake slot registry handing back fixed entries. */
function registryOf(entries: readonly ConversationViewEntry[]): ConversationViewSlots {
  return { entries: () => entries, subscribe: () => () => {} }
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

describe('conversationViewsColumns', () => {
  it('declares the id, label, order, and registrant columns', () => {
    const columns = conversationViewsColumns(translator())
    expect(columns.map(column => column.key)).toEqual(['id', 'label', 'order', 'registrant'])
    expect(columns.map(column => column.label())).toEqual(['ID', '标签', '顺序', '注册方'])
    expect(columns[0]?.mono).toBe(true)
    expect(columns.slice(1).map(column => column.mono)).toEqual([undefined, undefined, undefined])
  })
})

describe('createConversationViewsSource', () => {
  it('declares its identity, order, category copy, and subscription', () => {
    const source = createConversationViewsSource(registryOf([]), translator())
    expect(source.id).toBe(CONVERSATION_VIEWS_SOURCE_ID)
    expect(source.order).toBe(CONVERSATION_VIEWS_SOURCE_ORDER)
    expect(source.label()).toBe(zh['section.label'])
    expect(source.description?.()).toBe(zh['section.description'])
    expect(source.subscribe).toBeTypeOf('function')
    expect(source.getSnapshot()).toEqual({ status: 'ready', rows: [], note: zh['note'] })
  })

  it('maps entries with a string id and skips entries without one', () => {
    const source = createConversationViewsSource(registryOf([
      {
        options: { id: 'conversation', label: '对话', order: 0 },
        registrant: '@deepseek-ai/dsh-client-ui-conversation',
      },
      { options: { id: 'trajectory', order: 10 } },
      { options: { label: 'no id' } },
      { options: { id: '', label: 'empty id' } },
    ]), translator())
    const snapshot = source.getSnapshot()
    expect(snapshot.status).toBe('ready')
    expect(snapshot.note).toBe(zh['note'])
    expect(snapshot.rows.map(value => value.id)).toEqual(['conversation', 'trajectory'])

    const conversation = row(snapshot.rows, 'conversation')
    expect(conversation.cells).toEqual({
      id: 'conversation',
      label: '对话',
      order: '0',
      registrant: '@deepseek-ai/dsh-client-ui-conversation',
    })

    const trajectory = row(snapshot.rows, 'trajectory')
    expect(trajectory.cells).toEqual({
      id: 'trajectory',
      label: 'trajectory',
      order: '10',
      registrant: '@deepseek-ai/dsh-client-ui-trajectory',
    })
  })

  it('resolves thunked labels and falls back to the id when a thunk throws', () => {
    const source = createConversationViewsSource(registryOf([
      { options: { id: 'context', label: () => '上下文' } },
      { options: { id: 'broken', label: () => { throw new Error('label boom') } } },
    ]), translator())
    expect(row(source.getSnapshot().rows, 'context').cells.label).toBe('上下文')
    expect(row(source.getSnapshot().rows, 'broken').cells.label).toBe('broken')
  })

  it('lists registrant, order, and the key only when declared', () => {
    const source = createConversationViewsSource(registryOf([
      { options: { id: 'formation', order: 30, key: 'formation' }, registrant: 'ui-formation' },
      { options: { id: 'plain' } },
    ]), translator())
    const formation = row(source.getSnapshot().rows, 'formation')
    expect(detail(formation, '注册方')).toBe('ui-formation')
    expect(detail(formation, '顺序')).toBe('30')
    expect(detail(formation, '键')).toBe('formation')

    const plain = row(source.getSnapshot().rows, 'plain')
    expect(detail(plain, '注册方')).toBe('—')
    expect(detail(plain, '顺序')).toBe('0')
    expect(plain.details?.some(item => item.label === '键')).toBe(false)
  })

  it('re-evaluates localized copy on every read', () => {
    let dict: Record<string, string> = zh
    const t = (key: RegViewKey): string => dict[key] ?? key
    const source = createConversationViewsSource(registryOf([
      { options: { id: 'conversation', label: () => t('column.label') } },
    ]), t)
    expect(source.label()).toBe(zh['section.label'])
    expect(row(source.getSnapshot().rows, 'conversation').cells.label).toBe('标签')
    dict = en
    expect(source.label()).toBe(en['section.label'])
    expect(source.getSnapshot().note).toBe(en['note'])
    expect(row(source.getSnapshot().rows, 'conversation').cells.label).toBe('Label')
  })

  it('forwards subscriptions for the conversation.view slot and returns its disposer', () => {
    let notify: (() => void) | undefined
    let observedKey: string | undefined
    const listener = vi.fn()
    const unsubscribe = vi.fn()
    const source = createConversationViewsSource({
      entries: () => [],
      subscribe: (key, fn) => {
        observedKey = key
        notify = fn
        return unsubscribe
      },
    }, translator())
    const release = source.subscribe?.(listener)
    expect(observedKey).toBe(CONVERSATION_VIEW_SLOT)
    expect(release).toBe(unsubscribe)
    notify?.()
    expect(listener).toHaveBeenCalledTimes(1)
    release?.()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('turns a throwing entries() into an error snapshot instead of throwing', () => {
    const source = createConversationViewsSource({
      entries: () => { throw new Error('slot exploded') },
      subscribe: () => () => {},
    }, translator())
    expect(() => source.getSnapshot()).not.toThrow()
    const snapshot = source.getSnapshot()
    expect(snapshot.status).toBe('error')
    expect(snapshot.rows).toEqual([])
    expect(snapshot.error).toMatch(/slot exploded/)
  })

  it('is structurally compatible with the core inspector contract', () => {
    const source: RegViewSource = createConversationViewsSource(registryOf([]), translator())
    expect(source.id).toBe(CONVERSATION_VIEWS_SOURCE_ID)
  })
})

describe('readConversationViewsSnapshot', () => {
  it('reads without a full client context', () => {
    const snapshot = readConversationViewsSnapshot(registryOf([
      { options: { id: 'conversation' } },
    ]), translator())
    expect(snapshot.status).toBe('ready')
    expect(snapshot.rows.map(value => value.id)).toEqual(['conversation'])
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
      slots: registryOf([{ options: { id: 'conversation' } }]),
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
    expect(effects).toEqual(['regview.conversationViews: dictionaries', 'regview.conversationViews: category'])
    expect(localeRegister).toHaveBeenCalledTimes(1)
    expect(localeRegister.mock.calls[0]?.[0]).toBe('regview.conversationViews')
    expect(localeRegister.mock.calls[0]?.[1]).toEqual({ zh, en })
    expect(registered).toHaveLength(1)
    expect(registered[0]?.id).toBe(CONVERSATION_VIEWS_SOURCE_ID)
    expect(registered[0]?.getSnapshot().rows).toHaveLength(1)
  })
})
