/** `regview` namespace dictionaries for the inspector shell. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'panel.title': '注册中心',
  'panel.description': '查看 Web Client 当前注册的协议、Tab、文档预览与 Slot 组合。',
  'tabs.label': '注册表分类',
  'refresh': '刷新',
  'search.placeholder': '过滤键、注册方或值',
  'loading': '读取中…',
  'empty.sections': '没有已安装的数据源。安装任一 @dsh-regview/* 数据源插件后，对应分类会出现在这里。',
  'empty.rows': '当前注册表为空。',
  'empty.matches': '没有匹配项。',
  'note': '说明',
  'error': '读取失败：{message}',
  'count': '显示 {shown} / {total} 项',
  'truncated': '仅显示前 {max} 项',
  'expand': '展开详情',
  'tree.expandAll': '展开全部',
  'tree.collapseAll': '折叠全部',
  'tree.expand': '展开子项',
  'tree.collapse': '收起子项',
  'tree.details': '详情',
  'collapse': '收起详情',
} satisfies Record<string, string>

/** The base namespace key union. */
export type RegViewKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'panel.title': 'Registry',
  'panel.description': 'Inspect the live resource protocols, tab types, document previews, and Slots of the Web Client.',
  'tabs.label': 'Registry categories',
  'refresh': 'Refresh',
  'search.placeholder': 'Filter by key, owner, or value',
  'loading': 'Reading…',
  'empty.sections': 'No registry sources are installed. Install any @dsh-regview/* source package and its category appears here.',
  'empty.rows': 'This registry is empty.',
  'empty.matches': 'No matches.',
  'note': 'Note',
  'error': 'Read failed: {message}',
  'count': 'Showing {shown} of {total}',
  'truncated': 'Showing the first {max} entries',
  'expand': 'Expand details',
  'tree.expandAll': 'Expand all',
  'tree.collapseAll': 'Collapse all',
  'tree.expand': 'Expand children',
  'tree.collapse': 'Collapse children',
  'tree.details': 'Details',
  'collapse': 'Collapse details',
} satisfies Record<RegViewKey, string>
