/**
 * Host half of `@dsh-regview/core`.
 *
 * The panel is a browser feature; this half exists so the Loader can mount the
 * package row. It registers nothing and holds no state.
 */

/** Stable Cordis plugin name. */
export const name = '@dsh-regview/core'

/** Host-side no-op; the browser half owns every registration. */
export function apply(): void {}
