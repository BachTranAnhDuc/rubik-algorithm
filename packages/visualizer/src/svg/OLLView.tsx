import type { JSX } from 'react'

import { TopView, type TopViewProps } from './TopView'

export type OLLViewProps = TopViewProps & {
  // When true, masks any non-U sticker on the U-face top with the neutral
  // sticker character `n`. Useful when the case state's U-face should show
  // orientation only (oriented vs not), not the underlying side colors.
  readonly highlightOriented?: boolean
}

const maskOrientation = (state: string): string => {
  if (state.length !== 54) return state
  const chars = state.split('')
  for (let i = 0; i < 9; i++) {
    if (chars[i] !== 'U') chars[i] = 'n'
  }
  return chars.join('')
}

// Pure-SVG OLL diagram: TopView with optional U-face masking that reduces it
// to a binary oriented/not presentation.
export const OLLView = ({
  state,
  highlightOriented = false,
  title = 'OLL diagram',
  ...rest
}: OLLViewProps): JSX.Element => {
  const finalState = highlightOriented ? maskOrientation(state) : state
  return <TopView state={finalState} title={title} {...rest} />
}
