import { defineConfig } from 'vitest/config'

/** Unit and component tests run in Node; component specs opt into jsdom per file. */
export default defineConfig({
  test: {
    include: ['packages/*/tests/**/*.spec.{ts,tsx}'],
    environment: 'node',
    restoreMocks: true,
  },
})
