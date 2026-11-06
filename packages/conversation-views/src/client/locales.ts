/** `regview.conversationViews` namespace dictionaries for the conversation.view source. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'section.label': '会话视图',
  'section.description': '会话视图插槽中注册的视图页签。',
  'column.id': 'ID',
  'column.label': '标签',
  'column.order': '顺序',
  'column.registrant': '注册方',
  'value.none': '—',
  'note': '这些是“对话 / 轨迹 / 上下文 / 编队”等页签；仅在会话视图插槽挂载期间存在。chat / trajectory 使用内置包名映射；其他静态 shell 视图的 registrant 可能是压缩后的 fiber 名。',
  'detail.registrant': '注册方',
  'detail.order': '顺序',
  'detail.key': '键',
} satisfies Record<string, string>

/** The namespace key union. */
export type RegViewKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'section.label': 'Views',
  'section.description': 'View tabs registered in the conversation view slot.',
  'column.id': 'ID',
  'column.label': 'Label',
  'column.order': 'Order',
  'column.registrant': 'Registrant',
  'value.none': '—',
  'note': 'These are the Conversation / Trajectory / Context / Formation tabs; they exist only while the conversation view slot is mounted. chat / trajectory use a built-in package map; other static-shell views may expose a minified fiber name.',
  'detail.registrant': 'Registrant',
  'detail.order': 'Order',
  'detail.key': 'Key',
} satisfies Record<RegViewKey, string>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Conversation-view category copy owned by `@dsh-regview/conversation-views`. */
    'regview.conversationViews': RegViewKey
  }
}
