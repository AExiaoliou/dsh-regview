// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { RegViewPage, type RegViewPageProps } from '../src/client/panel/RegViewPage.tsx'
import type { RegViewSectionInfo, RegViewSnapshot } from '../src/client/contract.ts'

afterEach(cleanup)

vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => {
  const React = await import('react')
  const Icon = () => React.createElement('span', { 'aria-hidden': 'true' })
  interface MockButtonProps {
    children?: ReactNode
    icon?: ReactNode
    variant?: string
    size?: string
    [key: string]: unknown
  }
  const Button = ({ children, icon, variant: _variant, size: _size, ...rest }: MockButtonProps) =>
    React.createElement('button', rest, icon, children)
  const Input = React.forwardRef<HTMLInputElement, { icon?: ReactNode; [key: string]: unknown }>(
    ({ icon: _icon, ...rest }, ref) => React.createElement('input', { ...rest, ref }),
  )
  const SegmentedTabs = ({ items, value, onChange, label }: {
    items: readonly { value: string; label: ReactNode; id: string }[]
    value: string
    onChange: (value: string) => void
    label: string
  }) => React.createElement(
    'div',
    { role: 'tablist', 'aria-label': label },
    items.map(item => React.createElement(
      'button',
      {
        key: item.value,
        id: item.id,
        role: 'tab',
        'aria-selected': item.value === value,
        onClick: () => { onChange(item.value) },
      },
      item.label,
    )),
  )
  return {
    Button,
    Input,
    SegmentedTabs,
    IconRefreshOutlineRegular: Icon,
    IconSearchOutlineRegular: Icon,
    IconChevronRightOutlineRegular: Icon,
  }
})

const sections: readonly RegViewSectionInfo[] = [
  { id: 'resources', order: 10, label: () => 'Resources', description: () => 'Protocols', columns: [{ key: 'protocol', label: () => 'Protocol', mono: true }] },
  { id: 'slots', order: 20, label: () => 'Slots', columns: [{ key: 'key', label: () => 'Slot', mono: true }] },
  {
    id: 'tree',
    order: 30,
    label: () => 'Tree',
    tree: true,
    columns: [
      { key: 'key', label: () => 'Key', mono: true },
      { key: 'kind', label: () => 'Kind' },
    ],
  },
]

function snapshots(): Map<string, RegViewSnapshot> {
  return new Map([
    ['resources', {
      status: 'ready',
      rows: [
        { id: 'file', cells: { protocol: 'file' }, details: [{ label: 'Registration order', value: '1' }] },
        { id: 'plan', cells: { protocol: 'plan' } },
      ],
    }],
    ['slots', { status: 'ready', rows: [{ id: 'main', cells: { key: 'main' } }] }],
    ['tree', {
      status: 'ready',
      rows: [
        { id: 'root', cells: { key: 'root', kind: 'single' }, hasChildren: true, details: [{ label: 'Note', value: 'root detail' }] },
        { id: 'child', cells: { key: 'child', kind: 'list' }, depth: 1, hasChildren: true },
        { id: 'grandchild', cells: { key: 'grandchild', kind: 'list' }, depth: 2 },
      ],
    }],
  ])
}

function translate(key: string, params?: Record<string, unknown>): string {
  return params === undefined ? key : `${key}(${JSON.stringify(params)})`
}

function props(overrides: {
  sections?: readonly RegViewSectionInfo[]
  snapshots?: Map<string, RegViewSnapshot>
  refresh?: (id?: string) => void
} = {}): RegViewPageProps {
  const currentSections = overrides.sections ?? sections
  const currentSnapshots = overrides.snapshots ?? snapshots()
  return {
    useSections: (selector: (value: readonly RegViewSectionInfo[]) => unknown) => selector(currentSections),
    useSnapshots: (selector: (value: ReadonlyMap<string, RegViewSnapshot>) => unknown) => selector(currentSnapshots),
    useLocaleTick: (selector: (value: number) => unknown) => selector(0),
    refresh: overrides.refresh ?? (() => {}),
    t: translate,
  } as unknown as RegViewPageProps
}

describe('RegViewPage', () => {
  it('renders categories and the first category table', () => {
    render(<RegViewPage {...props()} />)
    expect(screen.getByRole('heading', { name: 'panel.title' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Resources' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Slots' })).toBeTruthy()
    expect(screen.getByText('file')).toBeTruthy()
    expect(screen.queryByText('main')).toBeNull()
  })

  it('switches category, filters rows, and resets the query', () => {
    render(<RegViewPage {...props()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'plan' } })
    expect(screen.queryByText('file')).toBeNull()
    expect(screen.getByText('plan')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Slots' }))
    expect(screen.getByText('main')).toBeTruthy()
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('')
  })

  it('expands details and refreshes the active category', () => {
    const refresh = vi.fn()
    render(<RegViewPage {...props({ refresh })} />)
    fireEvent.click(screen.getByRole('button', { name: 'expand' }))
    expect(screen.getByText('Registration order')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }))
    expect(refresh).toHaveBeenCalledWith('resources')
  })

  it('renders a collapsible tree and its details', () => {
    render(<RegViewPage {...props()} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Tree' }))
    expect(screen.getByText('root')).toBeTruthy()
    expect(screen.getByText('child')).toBeTruthy()
    expect(screen.getByText('grandchild')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'tree.collapse' })[0] as HTMLElement)
    expect(screen.queryByText('child')).toBeNull()
    expect(screen.queryByText('grandchild')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'tree.expand' }))
    expect(screen.getByText('child')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'tree.details' })[0] as HTMLElement)
    expect(screen.getByText('root detail')).toBeTruthy()
  })

  it('renders an error snapshot without failing the page', () => {
    const map = new Map<string, RegViewSnapshot>([
      ['resources', { status: 'error', rows: [], error: 'boom' }],
      ['slots', { status: 'ready', rows: [] }],
    ])
    render(<RegViewPage {...props({ snapshots: map })} />)
    expect(screen.getByRole('alert').textContent).toContain('boom')
  })

  it('shows the no-sources state', () => {
    render(<RegViewPage {...props({ sections: [] })} />)
    expect(screen.getByText('empty.sections')).toBeTruthy()
  })
})
