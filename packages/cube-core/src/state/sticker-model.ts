import type { Face, State } from '../types'

export const FACE_ORDER: readonly Face[] = ['U', 'F', 'R', 'D', 'L', 'B']
export const FACE_OFFSET: Readonly<Record<Face, number>> = {
  U: 0,
  F: 9,
  R: 18,
  D: 27,
  L: 36,
  B: 45,
}
export const STICKER_COUNT = 54

const buildSolved = (): State => {
  const out: string[] = []
  for (const face of FACE_ORDER) {
    for (let i = 0; i < 9; i++) out.push(face)
  }
  return out.join('')
}

export const SOLVED_STATE: State = buildSolved()

export const isSolved = (state: State): boolean => state === SOLVED_STATE

export const fromStickerString = (input: string): State => {
  const cleaned = input.replace(/\s+/g, '')
  if (cleaned.length !== STICKER_COUNT) {
    throw new Error(
      `state must be ${STICKER_COUNT} characters (whitespace ignored), got ${cleaned.length}`,
    )
  }
  return cleaned
}

export const toStickerString = (state: State): string => state

export const stateEquals = (a: State, b: State): boolean => a === b

// A stable hash of the state, suitable for keying in maps and sets.
// We just use the canonical sticker string itself.
export const hashState = (state: State): string => state

// Index helper: sticker at face + index-within-face.
export const stickerIndex = (face: Face, withinFace: number): number => {
  if (withinFace < 0 || withinFace > 8) {
    throw new Error(`withinFace out of range: ${withinFace}`)
  }
  return FACE_OFFSET[face] + withinFace
}
