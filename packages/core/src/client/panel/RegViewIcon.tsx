/** Decorative sidebar occupant for the registry inspector entry. */
import type { ReactNode } from 'react'
import { IconInspectOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * Render the inspect glyph at the size the sidebar requests.
 * @param props - the sidebar's icon share.
 * @returns the icon element.
 */
export function RegViewIcon({ size }: PropsRuntime<'sidebar.panellist'>): ReactNode {
  return <IconInspectOutlineRegular size={size} />
}
