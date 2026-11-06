import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../', import.meta.url)
const packagesDir = new URL('packages/', root)
const dryRun = process.env.DRY_RUN === 'true'
const registry = process.env.NPM_CONFIG_REGISTRY || 'https://registry.npmjs.org'

const packages = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => new URL(`packages/${entry.name}/package.json`, root))
  .map((url) => JSON.parse(readFileSync(url, 'utf8')))
  .sort((a, b) => a.name.localeCompare(b.name))

for (const pkg of packages) {
  const spec = `${pkg.name}@${pkg.version}`
  let published = false

  try {
    execFileSync('npm', ['view', spec, 'version', '--registry', registry], {
      stdio: 'ignore',
    })
    published = true
  } catch {
    // npm exits non-zero when this exact version is not published yet.
  }

  if (published) {
    console.log(`skip ${spec} (already published)`)
    continue
  }

  const args = ['publish', '--access', 'public', '--provenance', '--registry', registry]
  if (dryRun) args.push('--dry-run')

  console.log(`${dryRun ? 'preview' : 'publish'} ${spec}`)
  execFileSync('npm', args, {
    cwd: join(new URL('../', import.meta.url).pathname, 'packages', pkg.name.split('/').at(-1)),
    stdio: 'inherit',
  })
}
