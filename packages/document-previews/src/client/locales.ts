/** `regview.documentPreviews` namespace dictionaries for the document-preview source. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'section.label': '文档预览',
  'section.description': '当前客户端注册的文档预览实现，按文件扩展名匹配。',
  'column.id': '实现 ID',
  'column.extensions': '扩展名',
  'column.binary': '二进制后缀',
  'column.priority': '优先级',
  'column.loading': '加载方式',
  'column.wrap': '折行',
  'wrap.yes': '是',
  'wrap.no': '否',
  'note': '注册方由实现 ID 的前缀推断（最后一个 / 之前的部分）；文档预览注册表本身不记录实现所属的包。检查器不会调用定义的 title()。',
  'detail.id': '完整实现 ID',
  'detail.owner': '注册方（推断）',
  'detail.priority': '优先级',
  'detail.loading': '加载方式',
  'detail.wrap': '折行',
  'detail.binary': '二进制后缀',
} satisfies Record<string, string>

/** The namespace key union. */
export type RegViewKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'section.label': 'Previews',
  'section.description': 'Document preview implementations registered by this client, matched by file suffix.',
  'column.id': 'Implementation id',
  'column.extensions': 'Extensions',
  'column.binary': 'Binary suffixes',
  'column.priority': 'Priority',
  'column.loading': 'Loading',
  'column.wrap': 'Wrap',
  'wrap.yes': 'Yes',
  'wrap.no': 'No',
  'note': "The registrant is inferred from the implementation id (the part before its last '/'); the document-preview registry does not record the owning package. The inspector never calls a definition's title().",
  'detail.id': 'Full implementation id',
  'detail.owner': 'Registrant (inferred)',
  'detail.priority': 'Priority',
  'detail.loading': 'Loading',
  'detail.wrap': 'Wrap',
  'detail.binary': 'Binary suffixes',
} satisfies Record<RegViewKey, string>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Document-preview category copy owned by `@dsh-regview/document-previews`. */
    'regview.documentPreviews': RegViewKey
  }
}
