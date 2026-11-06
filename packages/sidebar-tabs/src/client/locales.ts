/** `regview.sidebarTabs` namespace dictionaries for the right-Sidebar tab-type source. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'section.label': '右侧边栏 Tab',
  'section.description': '右侧边栏当前生效的 Tab 类型。',
  'column.kind': '类型',
  'column.id': '实现 ID',
  'column.priority': '优先级',
  'column.patterns': '地址模式',
  'column.guides': '引导项',
  'value.yes': '是',
  'value.no': '否',
  'value.none': '—',
  'note': '仅列出当前生效的实现；被扩展覆盖的内建类型不会通过公开的注册表 API 暴露。',
  'detail.multiple': '多开',
  'detail.keepMounted': '保持挂载',
  'detail.canOpen': 'canOpen 谓词',
  'detail.pattern': '匹配模式',
} satisfies Record<string, string>

/** The namespace key union. */
export type RegViewKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'section.label': 'Sidebar tabs',
  'section.description': 'Tab types currently in force for the right Sidebar.',
  'column.kind': 'Kind',
  'column.id': 'Implementation id',
  'column.priority': 'Priority',
  'column.patterns': 'Patterns',
  'column.guides': 'Guide entries',
  'value.yes': 'Yes',
  'value.no': 'No',
  'value.none': '—',
  'note': 'Only the in-force implementation is listed; an extension-shadowed builtin is not exposed by the public registry API.',
  'detail.multiple': 'Multiple',
  'detail.keepMounted': 'Keep mounted',
  'detail.canOpen': 'canOpen predicate',
  'detail.pattern': 'Pattern',
} satisfies Record<RegViewKey, string>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Right-Sidebar tab-type category copy owned by `@dsh-regview/sidebar-tabs`. */
    'regview.sidebarTabs': RegViewKey
  }
}
