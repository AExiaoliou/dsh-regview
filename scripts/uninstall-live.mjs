/** Remove the managed dsh-regview block from a profile's user patch layer. */
import { copyFile, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import yaml from 'js-yaml'
import { BLOCK_START, removeBlock } from './profile-patch.mjs'

function flag(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const home = flag('home', process.env.DSH_HOME ?? join(homedir(), '.dsh'))
const profile = flag('profile', 'web')
const patchPath = join(home, 'profiles', profile, 'cordis.patch.yml')

const body = await readFile(patchPath, 'utf8')
if (!body.includes(BLOCK_START)) {
  console.log(`No managed dsh-regview block in ${patchPath}`)
  process.exit(0)
}
const next = removeBlock(body)
try {
  yaml.load(next)
} catch (error) {
  console.error(`Refusing to write invalid YAML: ${error.message}`)
  process.exit(1)
}
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
await copyFile(patchPath, `${patchPath}.bak-regview-${stamp}`)
const temp = `${patchPath}.tmp-regview`
await writeFile(temp, next)
await rename(temp, patchPath)
console.log(`Removed the dsh-regview block from ${patchPath}`)
console.log(`Backup: ${patchPath}.bak-regview-${stamp}`)
console.log('The running profile watches this file; refresh the Web page to unload the panel.')
