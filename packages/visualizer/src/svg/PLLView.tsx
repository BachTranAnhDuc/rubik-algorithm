import type { JSX } from 'react'

import { TopView, type TopViewProps } from './TopView'

export type PLLViewProps = Omit<TopViewProps, 'layout' | 'gridWidth' | 'gridHeight'>

// Pure-SVG PLL diagram: TopView styled for the PLL chart. Permutation arrows
// are deferred — they require a per-case mapping (cycles + arc geometry) that
// belongs with content rendering and isn't load-bearing for v1 catalog pages.
export const PLLView = (props: PLLViewProps): JSX.Element => (
  <TopView {...props} title={props.title ?? 'PLL diagram'} />
)
