/**
 * Install the built packages into a running profile's user patch layer.
 *
 * The running dsh profile watches this file, so a correct append recomposes the
 * Loader tree and lets HMR add the browser rows. A timestamped backup is taken
 * before every write and the result is parsed before it replaces the original.
 */
import { copyFile, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { applyBlock, packageRows, patchBlock } from './profile-patch.mjs'

function flag(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const root = fileURLToPath(new URL('..', import.meta.url))
const home = flag('home', process.env.DSH_HOME ?? join(homedir(), '.dsh'))
const profile = flag('profile', 'web')
const dryRun = process.argv.includes('--dry-run')
const patchPath = join(home, 'profiles', profile, 'cordis.patch.yml')

const rows = packageRows(root)
const missing = rows.filter(row => !row.built)
if (missing.length > 0) {
  console.error('Refusing to install: build first; missing ' + missing.map(row => row.name).join(', '))
  process.exit(1)
}
const block = patchBlock(rows)

let body = ''
try {
  body = await readFile(patchPath, 'utf8')
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
const next = applyBlock(body, block)
let parsed
try {
  parsed = yaml.load(next)
} catch (error) {
  console.error(`Refusing to write invalid YAML: ${error.message}`)
  process.exit(1)
}
if (!Array.isArray(parsed)) {
  console.error('Refusing to write: the profile patch is not a YAML list')
  process.exit(1)
}
const ids = new Set()
for (const entry of parsed) {
  if (typeof entry?.id === 'string') ids.add(entry.id)
  if (Array.isArray(entry?.insert)) {
    for (const child of entry.insert) {
      if (typeof child?.id === 'string') ids.add(child.id)
    }
  }
}
for (const row of rows) {
  if (!ids.has(row.id)) {
    console.error(`Refusing to write: composed patch is missing ${row.id}`)
    process.exit(1)
  }
}

if (dryRun) {
  console.log(next)
  process.exit(0)
}

const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
if (body !== '') await copyFile(patchPath, `${patchPath}.bak-regview-${stamp}`)
const temp = `${patchPath}.tmp-regview`
await writeFile(temp, next)
await rename(temp, patchPath)
console.log(`Installed ${rows.length} dsh-regview rows into ${patchPath}`)
console.log('Backup: ' + (body === '' ? '(new file)' : `${patchPath}.bak-regview-${stamp}`))
console.log('The running profile watches this file; refresh the Web page if the panel does not appear.')
