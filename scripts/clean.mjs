import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'

const packages = new URL('../packages/', import.meta.url)
for (const entry of await readdir(packages, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  await rm(join(packages.pathname, entry.name, 'lib'), { recursive: true, force: true })
}
