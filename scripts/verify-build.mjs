/**
 * Verify every built package's published contract without booting DSH.
 *
 * Checks the Node half, the lazy-CJS browser wrapper id, the declared export
 * targets, and that the browser bundle only requires shell-seeded platform
 * modules. Exits non-zero on the first package with any failure.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url)
const PACKAGES = join(ROOT.pathname, 'packages')

const PLATFORM_MODULES = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  'zod',
  '@tanstack/react-virtual',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
])

const failures = []
const rows = []

for (const entry of readdirSync(PACKAGES, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
  if (!entry.isDirectory()) continue
  const dir = join(PACKAGES, entry.name)
  const manifestPath = join(dir, 'package.json')
  if (!existsSync(manifestPath)) continue
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.dsh?.client === undefined) continue
  const problems = []
  const nodePath = join(dir, 'lib/index.js')
  const clientPath = join(dir, 'lib/client.js')
  const typesPath = join(dir, 'lib/types/index.d.ts')
  if (!existsSync(nodePath)) problems.push('missing lib/index.js')
  else if (!readFileSync(nodePath, 'utf8').includes('apply')) problems.push('lib/index.js does not export apply')
  if (!existsSync(clientPath)) problems.push('missing lib/client.js')
  else {
    const client = readFileSync(clientPath, 'utf8')
    if (!client.includes('window.__ModuleLoader__.load')) problems.push('client bundle has no module-loader handoff')
    if (!client.includes(`id: ${JSON.stringify(manifest.name)}`)) {
      problems.push(`client bundle id does not match ${manifest.name}`)
    }
    for (const match of client.matchAll(/require\("([^"]+)"\)/g)) {
      const specifier = match[1]
      if (specifier.startsWith('@deepseek-ai/') && !PLATFORM_MODULES.has(specifier)) {
        problems.push(`client bundle requires non-platform module ${specifier}`)
      }
    }
  }
  if (!existsSync(typesPath)) problems.push('missing lib/types/index.d.ts')
  const clientExport = manifest.exports?.['./client']?.default
  if (typeof clientExport !== 'string') problems.push('exports["./client"].default is not declared')
  else if (!existsSync(join(dir, clientExport))) problems.push(`exports["./client"] target ${clientExport} is missing`)
  if (!existsSync(join(dir, manifest.main ?? ''))) problems.push(`main target ${manifest.main} is missing`)

  const bundleSize = existsSync(clientPath) ? statSync(clientPath).size : 0
  rows.push({ name: manifest.name, size: bundleSize, status: problems.length === 0 ? 'ok' : 'FAIL' })
  for (const problem of problems) failures.push(`${manifest.name}: ${problem}`)
}

for (const row of rows) {
  console.log(`${row.status.padEnd(4)} ${row.name} (${(row.size / 1024).toFixed(1)} KiB client bundle)`)
}
if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`\n${rows.length} package(s) verified.`)
