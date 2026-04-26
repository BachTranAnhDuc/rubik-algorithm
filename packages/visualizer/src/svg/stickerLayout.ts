// 5×5 grid layout for the "U + side strips" diagram used by PLL/OLL views.
// Coordinates are in cell units (col, row); render-time consumers multiply by
// a sticker size to get pixel/SVG coordinates.
//
// Layout (col 0..4 left-to-right, row 0..4 top-to-bottom):
//
//      .  B2 B1 B0  .
//      L0 U0 U1 U2 R2
//      L1 U3 U4 U5 R1
//      L2 U6 U7 U8 R0
//      .  F0 F1 F2  .
//
// where letter = state index within face. The B-strip is mirrored because we
// view the back face's top row from above (looking down at U).
//
// Sticker indices map to global state indices via:
//   U[i] = 0 + i,  F[i] = 9 + i,  R[i] = 18 + i,
//   D[i] = 27 + i, L[i] = 36 + i, B[i] = 45 + i.

export interface StickerCell {
  readonly col: number
  readonly row: number
  readonly stateIndex: number
}

const FACE_OFFSET = { U: 0, F: 9, R: 18, D: 27, L: 36, B: 45 } as const

export const TOP_VIEW_GRID_SIZE = 5

export const TOP_VIEW_LAYOUT: readonly StickerCell[] = [
  { col: 1, row: 1, stateIndex: FACE_OFFSET.U + 0 },
  { col: 2, row: 1, stateIndex: FACE_OFFSET.U + 1 },
  { col: 3, row: 1, stateIndex: FACE_OFFSET.U + 2 },
  { col: 1, row: 2, stateIndex: FACE_OFFSET.U + 3 },
  { col: 2, row: 2, stateIndex: FACE_OFFSET.U + 4 },
  { col: 3, row: 2, stateIndex: FACE_OFFSET.U + 5 },
  { col: 1, row: 3, stateIndex: FACE_OFFSET.U + 6 },
  { col: 2, row: 3, stateIndex: FACE_OFFSET.U + 7 },
  { col: 3, row: 3, stateIndex: FACE_OFFSET.U + 8 },

  { col: 1, row: 0, stateIndex: FACE_OFFSET.B + 2 },
  { col: 2, row: 0, stateIndex: FACE_OFFSET.B + 1 },
  { col: 3, row: 0, stateIndex: FACE_OFFSET.B + 0 },

  { col: 1, row: 4, stateIndex: FACE_OFFSET.F + 0 },
  { col: 2, row: 4, stateIndex: FACE_OFFSET.F + 1 },
  { col: 3, row: 4, stateIndex: FACE_OFFSET.F + 2 },

  { col: 0, row: 1, stateIndex: FACE_OFFSET.L + 0 },
  { col: 0, row: 2, stateIndex: FACE_OFFSET.L + 1 },
  { col: 0, row: 3, stateIndex: FACE_OFFSET.L + 2 },

  { col: 4, row: 1, stateIndex: FACE_OFFSET.R + 2 },
  { col: 4, row: 2, stateIndex: FACE_OFFSET.R + 1 },
  { col: 4, row: 3, stateIndex: FACE_OFFSET.R + 0 },
]

export interface RenderedSticker extends StickerCell {
  readonly character: string
}

// Reads each layout cell from a 54-char state string and returns the sticker
// character to render at that cell. Throws on wrong-length state.
export const stickersFromState = (
  state: string,
  layout: readonly StickerCell[] = TOP_VIEW_LAYOUT,
): readonly RenderedSticker[] => {
  if (state.length !== 54) {
    throw new Error(`state must be 54 characters, got ${state.length}`)
  }
  return layout.map((cell) => ({
    ...cell,
    character: state[cell.stateIndex]!,
  }))
}

// F2L slot view: shows the U-face top + the FR slot (corner DFR + edge FR)
// laid out beneath the bottom-right of U.
//
//      L0 U0 U1 U2 R2
//      L1 U3 U4 U5 R1
//      L2 U6 U7 U8 R0
//       .  F0 F1 F2  .
//       .   .  Fe Re  .   ← FR edge stickers (F[5], R[3])
//       .   .  Fc Rc  .   ← DFR corner stickers (F[8], R[6], D[2])
//
// Implementation note: we surface only the diagram-relevant indices; the F2L
// view is consulted by content/UI for case-page hero images.
export const F2L_SLOT_LAYOUT: readonly StickerCell[] = [
  ...TOP_VIEW_LAYOUT,
  { col: 3, row: 5, stateIndex: FACE_OFFSET.F + 5 },
  { col: 4, row: 5, stateIndex: FACE_OFFSET.R + 3 },
  { col: 3, row: 6, stateIndex: FACE_OFFSET.F + 8 },
  { col: 4, row: 6, stateIndex: FACE_OFFSET.R + 6 },
]

export const F2L_VIEW_HEIGHT = 7
