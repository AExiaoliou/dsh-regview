/**
 * The marker-delimited patch block that installs every local package by file
 * path. Used by both install-live and the dry-run printer.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Marker opening the managed block. */
export const BLOCK_START = '# >>> dsh-regview managed block (install-live.mjs) >>>'
/** Marker closing the managed block. */
export const BLOCK_END = '# <<< dsh-regview managed block <<<'

/**
 * Read the built packages in install order.
 * @param root - repository root.
 * @returns package name, row id, and absolute Node entry.
 */
export function packageRows(root) {
  const packagesDir = join(root, 'packages')
  const order = ['core', 'resources', 'sidebar-tabs', 'conversation-views', 'document-previews', 'slots']
  const rows = []
  const present = new Set(readdirSync(packagesDir))
  for (const dirName of order) {
    if (!present.has(dirName)) continue
    const dir = join(packagesDir, dirName)
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    rows.push({
      dir,
      id: manifest.name.replace('@aexiaoliou/dsh-regview-', 'regview-'),
      name: manifest.name,
      entry: join(dir, 'lib/index.js'),
      built: existsSync(join(dir, 'lib/index.js')) && existsSync(join(dir, 'lib/client.js')),
    })
  }
  return rows
}

/**
 * Render the managed patch block.
 * @param rows - built package rows.
 * @returns YAML text including both markers.
 */
export function patchBlock(rows) {
  const lines = [BLOCK_START, '- insert:']
  for (const row of rows) {
    lines.push(`    - id: ${row.id}`)
    lines.push(`      name: '${row.entry.replaceAll("'", "''")}'`)
  }
  lines.push(BLOCK_END)
  return lines.join('\n')
}

/**
 * Replace or append the managed block in a patch file body.
 * @param body - current YAML text.
 * @param block - rendered managed block.
 * @returns the new body.
 */
export function applyBlock(body, block) {
  const start = body.indexOf(BLOCK_START)
  if (start >= 0) {
    const end = body.indexOf(BLOCK_END, start)
    if (end < 0) throw new Error('dsh-regview managed block has a start marker but no end marker')
    return `${body.slice(0, start)}${block}${body.slice(end + BLOCK_END.length)}`
  }
  // A freshly created profile patch is a `[]` document, optionally after its
  // template comments. A top-level list item cannot follow that token.
  if (/^(?:[ \t]*(?:#.*)?\r?\n)*[ \t]*\[\][ \t]*\r?\n?$/.test(body)) return `${block}\n`
  const prefix = body.trimEnd()
  return `${prefix}${prefix === '' ? '' : '\n\n'}${block}\n`
}

/**
 * Remove the managed block.
 * @param body - current YAML text.
 * @returns the body without the block.
 */
export function removeBlock(body) {
  const start = body.indexOf(BLOCK_START)
  if (start < 0) return body
  const end = body.indexOf(BLOCK_END, start)
  if (end < 0) throw new Error('dsh-regview managed block has a start marker but no end marker')
  const before = body.slice(0, start).trimEnd()
  const after = body.slice(end + BLOCK_END.length).trimStart()
  if (before === '') return after
  if (after === '') return `${before}\n`
  return `${before}\n${after}`
}
