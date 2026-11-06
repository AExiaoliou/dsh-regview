/**
 * Public browser entry of `@aexiaoliou/dsh-regview-core`.
 *
 * Feature packages import the contract types type-only and receive the runtime
 * service through `ctx.regview`; this entry exports no implementation values.
 */
export { apply, inject } from './apply.ts'
export type {
  RegViewColumn, RegViewDetail, RegViewInjected, RegViewRow, RegViewSectionInfo,
  RegViewService, RegViewSnapshot, RegViewSource,
} from './contract.ts'
