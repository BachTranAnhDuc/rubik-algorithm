import type { JSX } from 'react'

import { STROKE_COLOR, colorForSticker } from '../tokens/colors'
import {
  TOP_VIEW_GRID_SIZE,
  TOP_VIEW_LAYOUT,
  type StickerCell,
  stickersFromState,
} from './stickerLayout'

export interface TopViewProps {
  readonly state: string
  readonly size?: number
  readonly stickerSize?: number
  readonly stickerGap?: number
  readonly cornerRadius?: number
  readonly layout?: readonly StickerCell[]
  readonly gridWidth?: number
  readonly gridHeight?: number
  readonly title?: string
  readonly className?: string
}

const DEFAULT_PIXEL_SIZE = 160
const DEFAULT_GAP = 2
const DEFAULT_RADIUS = 3

// Pure-SVG diagram of the U face plus the four side-face top strips. Renders
// 21 stickers in a 5×5 grid with the back-face row mirrored. Server-component
// safe — no React hooks, no client state, no event handlers.
export const TopView = ({
  state,
  size = DEFAULT_PIXEL_SIZE,
  stickerSize,
  stickerGap = DEFAULT_GAP,
  cornerRadius = DEFAULT_RADIUS,
  layout = TOP_VIEW_LAYOUT,
  gridWidth = TOP_VIEW_GRID_SIZE,
  gridHeight = TOP_VIEW_GRID_SIZE,
  title,
  className,
}: TopViewProps): JSX.Element => {
  const cellSize = stickerSize ?? size / Math.max(gridWidth, gridHeight)
  const viewportWidth = cellSize * gridWidth
  const viewportHeight = cellSize * gridHeight
  const stickers = stickersFromState(state, layout)

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${viewportWidth} ${viewportHeight}`}
      width={viewportWidth}
      height={viewportHeight}
      role="img"
      aria-label={title ?? 'cube state diagram'}
      className={className}
    >
      {title ? <title>{title}</title> : null}
      {stickers.map((s) => (
        <rect
          key={`${s.col}-${s.row}`}
          x={s.col * cellSize + stickerGap / 2}
          y={s.row * cellSize + stickerGap / 2}
          width={cellSize - stickerGap}
          height={cellSize - stickerGap}
          rx={cornerRadius}
          ry={cornerRadius}
          fill={colorForSticker(s.character)}
          stroke={s.character === 't' ? 'none' : STROKE_COLOR}
          strokeWidth={1}
        />
      ))}
    </svg>
  )
}
