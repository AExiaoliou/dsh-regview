/**
 * The inspector's single stylesheet. Every color, radius, and duration is a
 * design token; class names are package-prefixed because a dynamic client
 * bundle injects the sheet into the shared document.
 */
export const REGVIEW_STYLES = `
.dsh-regview-page {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
  font-size: 14px;
  line-height: 1.6;
}
.dsh-regview-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable;
}
.dsh-regview-content {
  max-width: 1100px;
  margin: 0 auto;
  padding: 28px clamp(20px, 4vw, 48px) 48px;
}
.dsh-regview-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.dsh-regview-heading h1 {
  margin: 0;
  font-size: 20px;
  line-height: 28px;
  font-weight: 500;
}
.dsh-regview-subtitle {
  margin: 4px 0 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
}
.dsh-regview-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.dsh-regview-tabs-scroll {
  flex: 1 1 440px;
  min-width: 260px;
  overflow-x: auto;
}
.dsh-regview-tabs {
  min-width: 520px;
}
.dsh-regview-search {
  flex: 0 1 300px;
}
.dsh-regview-description {
  margin: 0 0 10px;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
}
.dsh-regview-note {
  margin: 0 0 12px;
  padding: 8px 10px;
  border-left: 2px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-xs);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}
.dsh-regview-error {
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
}
.dsh-regview-empty {
  margin: 0;
  padding: 36px 12px;
  border: 1px dashed var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-md);
  color: var(--dsw-alias-label-tertiary);
  text-align: center;
}
.dsh-regview-table-wrap {
  overflow: auto;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-1);
}
.dsh-regview-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
}
.dsh-regview-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 10px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-weight: 500;
  text-align: left;
  white-space: nowrap;
}
.dsh-regview-table tbody td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  vertical-align: top;
  overflow-wrap: anywhere;
  white-space: nowrap;
}
.dsh-regview-table tbody td[data-wrap='true'] {
  white-space: normal;
}
.dsh-regview-table tbody tr:last-child td {
  border-bottom: none;
}
.dsh-regview-table tbody tr:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-regview-wide {
  min-width: 260px;
}
.dsh-regview-mono {
  font-family: var(--ds-font-family-code);
  font-size: 12px;
}
.dsh-regview-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-right: 4px;
  padding: 0;
  border: none;
  background: none;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
  vertical-align: middle;
}
.dsh-regview-toggle svg {
  transition: transform var(--ds-transition-duration-fast, 0.1s) ease;
}
.dsh-regview-toggle[aria-expanded='true'] svg {
  transform: rotate(90deg);
}
.dsh-regview-details-row td {
  background: var(--dsw-alias-bg-layer-2);
}
.dsh-regview-details {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 4px 16px;
  margin: 0;
}
.dsh-regview-details dt {
  color: var(--dsw-alias-label-tertiary);
}
.dsh-regview-details dd {
  margin: 0;
  font-family: var(--ds-font-family-code);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.dsh-regview-tree-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
}
.dsh-regview-tree-actions {
  display: flex;
  gap: 4px;
}
.dsh-regview-tree {
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-1);
}
.dsh-regview-tree-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.dsh-regview-tree-row:last-child {
  border-bottom: none;
}
.dsh-regview-tree-row:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-regview-tree-spacer {
  flex: 0 0 18px;
  width: 18px;
}
.dsh-regview-tree-key {
  font-size: 12px;
  font-weight: 500;
}
.dsh-regview-tree-meta {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}
.dsh-regview-tree-meta-label {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
}
.dsh-regview-tree-details-button {
  margin-left: auto;
  padding: 0;
  border: none;
  background: none;
  color: var(--dsw-alias-link);
  font-size: 12px;
  cursor: pointer;
}
.dsh-regview-tree-details {
  padding: 8px 12px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
}
.dsh-regview-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
}
@media (max-width: 720px) {
  .dsh-regview-content {
    padding: 20px 14px 32px;
  }
  .dsh-regview-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .dsh-regview-search {
    flex: 1 1 auto;
  }
  .dsh-regview-tabs-scroll {
    flex: 0 0 auto;
    min-width: 0;
  }
  /* A table with many columns becomes labeled cards instead of a clipped row. */
  .dsh-regview-table thead {
    display: none;
  }
  .dsh-regview-table,
  .dsh-regview-table tbody,
  .dsh-regview-table tr,
  .dsh-regview-table td {
    display: block;
    width: 100%;
  }
  .dsh-regview-table tbody tr {
    padding: 8px 12px;
    border-bottom: 1px solid var(--dsw-alias-border-l1);
  }
  .dsh-regview-table tbody tr:last-child {
    border-bottom: none;
  }
  .dsh-regview-table-wrap {
    overflow-x: hidden;
  }
  .dsh-regview-table tbody td {
    padding: 2px 0;
    border-bottom: none;
    white-space: normal;
  }
  .dsh-regview-table tbody td .dsh-regview-mono {
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .dsh-regview-table tbody td[data-label]::before {
    content: attr(data-label);
    display: inline-block;
    min-width: 72px;
    color: var(--dsw-alias-label-tertiary);
  }
  .dsh-regview-details-row td {
    padding: 0;
  }
  .dsh-regview-wide {
    min-width: 0;
  }
}
`

/**
 * Inject the inspector stylesheet once per page.
 * @returns a disposer removing this insertion on plugin unload.
 */
export function injectRegViewStyles(): () => void {
  if (typeof document === 'undefined') return () => {}
  const existing = document.querySelector<HTMLStyleElement>('style[data-dsh-regview]')
  if (existing !== null) {
    existing.textContent = REGVIEW_STYLES
    return () => {}
  }
  const style = document.createElement('style')
  style.dataset.dshRegview = ''
  style.textContent = REGVIEW_STYLES
  document.head.append(style)
  return () => { style.remove() }
}
