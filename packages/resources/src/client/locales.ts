/** `regview.resources` namespace dictionaries for the resource-protocol source. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'section.label': '资源协议',
  'section.description': '当前客户端已注册的 dsh-resource:// 协议提供者。',
  'column.protocol': '协议',
  'column.registrant': '注册方',
  'column.address': '地址',
  'registrant.hintSuffix': '（内置推断）',
  'registrant.unknown': '未公开',
  'note': '资源注册表不公开 provider 的所属包，已知协议按 Web Client 的内置约定推断，其余显示为未公开。检查器只读取注册表，绝不调用 provider.open。',
  'detail.openType': 'provider.open 类型',
  'detail.order': '注册顺序',
  'detail.address': '地址示例',
} satisfies Record<string, string>

/** The namespace key union. */
export type RegViewKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'section.label': 'Resources',
  'section.description': 'dsh-resource:// protocol providers registered by this client.',
  'column.protocol': 'Protocol',
  'column.registrant': 'Registrant',
  'column.address': 'Address',
  'registrant.hintSuffix': ' (built-in hint)',
  'registrant.unknown': 'Not exposed',
  'note': 'DSH does not expose the provider owner; known protocols are inferred from Web Client built-in conventions and the rest show as not exposed. The inspector only reads the registry and never calls provider.open.',
  'detail.openType': 'provider.open type',
  'detail.order': 'Registration order',
  'detail.address': 'Address example',
} satisfies Record<RegViewKey, string>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Resource-protocol category copy owned by `@dsh-regview/resources`. */
    'regview.resources': RegViewKey
  }
}
