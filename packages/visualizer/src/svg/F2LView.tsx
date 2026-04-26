import type { JSX } from 'react'

import { TopView, type TopViewProps } from './TopView'
import { F2L_SLOT_LAYOUT, F2L_VIEW_HEIGHT, TOP_VIEW_GRID_SIZE } from './stickerLayout'

export type F2LViewProps = Omit<TopViewProps, 'layout' | 'gridWidth' | 'gridHeight'>

// Pure-SVG F2L diagram: TopView extended downward to show the FR slot pair
// (corner DFR + edge FR) below the bottom-right of U.
export const F2LView = (props: F2LViewProps): JSX.Element => (
  <TopView
    {...props}
    layout={F2L_SLOT_LAYOUT}
    gridWidth={TOP_VIEW_GRID_SIZE}
    gridHeight={F2L_VIEW_HEIGHT}
    title={props.title ?? 'F2L diagram'}
  />
)
