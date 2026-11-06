/** Print the absolute-path patch block for a profile's user layer. */
import { fileURLToPath } from 'node:url'
import { packageRows, patchBlock } from './profile-patch.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const rows = packageRows(root)
const missing = rows.filter(row => !row.built)
if (missing.length > 0) {
  console.error('Build first: missing artifacts for ' + missing.map(row => row.name).join(', '))
  process.exit(1)
}
console.log(patchBlock(rows))
