// Matches a single 3x3 WCA move token: face/wide/slice/rotation + optional ' or 2.
//   Faces:        U D F B R L
//   Wides (Uw):   Uw Dw Fw Bw Rw Lw
//   Wides (lc):   u d f b r l   (lowercase shorthand, equivalent to Xw — see
//                                 cubing-domain-research §7.6 / §3.6)
//   Slices:       M E S
//   Rotations:    x y z
//
// Suffix is one of: empty (90° clockwise), `'` (90° counter-clockwise), `2` (180°).
export const MOVE_TOKEN_REGEX = /^(?:[UDFBRL]w?|[udfbrl]|[MES]|[xyz])(?:'|2)?$/

export const isMoveToken = (token: string): boolean => MOVE_TOKEN_REGEX.test(token)

export const tokenizeNotation = (notation: string): string[] =>
  notation
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
