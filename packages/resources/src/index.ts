/**
 * Host half of `@dsh-regview/resources`.
 *
 * The registry source is a browser feature; this half only lets the Loader
 * mount the package row. It registers nothing and holds no state.
 */

/** Stable Cordis plugin name. */
export const name = '@dsh-regview/resources'

/** Host-side no-op; the browser half owns the source registration. */
export function apply(): void {}
