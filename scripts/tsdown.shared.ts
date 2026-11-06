/**
 * Shared build preset for every dsh-regview package.
 *
 * tsc emits JavaScript and declarations under `lib/types`; tsdown then emits the
 * Node half to `lib/index.js` and the browser half to `lib/client.js` in the
 * client module system's lazy-CJS factory form. The factory banner/footer are
 * the published contract the Web shell's module table expects; they mirror the
 * in-repo client preset without importing any unpublished build code.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'tsdown'

/** Browser specifiers the Web shell seeds into its frozen module table. */
const PLATFORM_MODULES = [
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
]

interface PackageManifest {
  readonly name: string
}

/**
 * Read a package's own name, which is also the module-table id in the wrapper.
 * @param packageDir - absolute package directory.
 * @returns the package name.
 * @throws when the manifest is missing or declares no string name.
 */
function packageName(packageDir: string): string {
  const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as PackageManifest
  if (typeof manifest.name !== 'string' || manifest.name === '') {
    throw new Error(`tsdown: ${packageDir}/package.json declares no package name`)
  }
  return manifest.name
}

/**
 * Build the two-face tsdown config for one package.
 * @param packageDir - the package directory, normally `import.meta.dirname`.
 * @returns tsdown config producing `lib/index.js` and `lib/client.js`.
 */
export function clientPackageConfig(packageDir: string) {
  const id = packageName(packageDir)
  return defineConfig([
    {
      name: `${id}/node`,
      entry: { index: 'lib/types/index.js' },
      outDir: 'lib',
      format: ['esm'],
      platform: 'node',
      target: 'es2022',
      fixedExtension: false,
      dts: false,
      clean: false,
      sourcemap: false,
    },
    {
      name: `${id}/client`,
      entry: { client: 'lib/types/client/index.js' },
      outDir: 'lib',
      format: ['cjs'],
      platform: 'browser',
      target: 'es2022',
      fixedExtension: false,
      dts: false,
      clean: false,
      sourcemap: true,
      deps: { neverBundle: PLATFORM_MODULES },
      outputOptions: {
        entryFileNames: 'client.js',
        banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
        intro: 'var module = { exports: {} }; var exports = module.exports;',
        footer: 'return module.exports; } });',
      },
    },
  ])
}
