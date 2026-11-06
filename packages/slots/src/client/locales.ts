/** `regview.slots` namespace dictionaries for the Slot / Factory tree source. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'section.label': 'Slot 组合',
  'section.description': '当前客户端已声明的运行时 Slot 与 Factory 组合树。',
  'column.key': '键',
  'column.kind': '类型',
  'column.scope': '作用域',
  'column.declaredBy': '声明方',
  'column.occupants': '占用项',
  'detail.children': '子项',
  'detail.registrant': '注册方',
  'detail.occupant': '占用项 {index}',
  'value.active': '活跃',
  'value.inactive': '未激活',
  'note': '仅显示运行时已声明的 Slot 与 Factory；未挂载的声明不存在；检查器每 1.5 秒刷新一次组合树。occupant 的 registrant 是 fiber name，静态 shell 插件可能只暴露压缩名。',
} satisfies Record<string, string>

/** The namespace key union. */
export type RegViewKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'section.label': 'Slots',
  'section.description': 'Runtime Slot and Factory declarations composed by this client.',
  'column.key': 'Key',
  'column.kind': 'Kind',
  'column.scope': 'Scope',
  'column.declaredBy': 'Declared by',
  'column.occupants': 'Occupants',
  'detail.children': 'Children',
  'detail.registrant': 'Registrant',
  'detail.occupant': 'Occupant {index}',
  'value.active': 'active',
  'value.inactive': 'inactive',
  'note': 'Only runtime-declared Slots and Factories appear; unmounted declarations do not exist; the inspector refreshes the composition tree every 1.5s. An occupant registrant is a fiber name, and static-shell plugins may expose a minified one.',
} satisfies Record<RegViewKey, string>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Composition-tree copy owned by `@dsh-regview/slots`. */
    'regview.slots': RegViewKey
  }
}
