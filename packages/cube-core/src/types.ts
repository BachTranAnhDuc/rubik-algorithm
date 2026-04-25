// 54-sticker representation. Faces in order U, F, R, D, L, B (UFRDLB).
// Each face has 9 stickers indexed row-major:
//
//   0 1 2
//   3 4 5
//   6 7 8
//
// Per-face viewpoint conventions (looking AT each face from outside the cube):
//   U: B at top of view, F at bottom, L at left, R at right
//   F: U at top, D at bottom, L at left, R at right
//   R: U at top, D at bottom, F at left, B at right
//   D: F at top of view, B at bottom, L at left, R at right
//   L: U at top, D at bottom, B at left, F at right
//   B: U at top, D at bottom, R at left, L at right
//
// Global indices:
//   U: 0..8     F: 9..17    R: 18..26
//   D: 27..35   L: 36..44   B: 45..53
export type State = string

export type Face = 'U' | 'F' | 'R' | 'D' | 'L' | 'B'

// 1 = clockwise, 2 = 180°, 3 = counter-clockwise (the "prime" suffix).
export type MoveAmount = 1 | 2 | 3

// All move axes in 3x3 WCA notation.
export type FaceAxis = Face
export type SliceAxis = 'M' | 'E' | 'S'
export type RotationAxis = 'x' | 'y' | 'z'
export type MoveAxis = FaceAxis | SliceAxis | RotationAxis

export interface Move {
  readonly axis: MoveAxis
  readonly amount: MoveAmount
  readonly wide: boolean // true for Uw/Rw/etc.; only valid for FaceAxis
}

export type Algorithm = readonly Move[]
