// RSC-safe entry point. Pure-SVG views with zero hydration cost.
// Import from this entry in Next.js Server Components and other SSR contexts.

export { TopView, type TopViewProps } from './svg/TopView'
export { PLLView, type PLLViewProps } from './svg/PLLView'
export { OLLView, type OLLViewProps } from './svg/OLLView'
export { F2LView, type F2LViewProps } from './svg/F2LView'

export {
  F2L_SLOT_LAYOUT,
  F2L_VIEW_HEIGHT,
  TOP_VIEW_GRID_SIZE,
  TOP_VIEW_LAYOUT,
  stickersFromState,
  type RenderedSticker,
  type StickerCell,
} from './svg/stickerLayout'

export {
  BACKGROUND_COLOR,
  STICKER_COLORS,
  STROKE_COLOR,
  colorForSticker,
  type StickerCharacter,
} from './tokens/colors'
