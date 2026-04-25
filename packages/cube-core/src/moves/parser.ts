import type { Algorithm, Move, MoveAmount, MoveAxis } from '../types'

// Branches:
//   1: uppercase face (with optional `w` wide modifier in match[2])
//   3: lowercase face (always wide; the lowercase form IS the shorthand)
//   4: slice M/E/S
//   5: rotation x/y/z
const MOVE_TOKEN_REGEX =
  /^([UDFBRL])(w?)(['2]?)$|^([udfbrl])(['2]?)$|^([MES])(['2]?)$|^([xyz])(['2]?)$/

const FACE_AXES = new Set<MoveAxis>(['U', 'D', 'F', 'B', 'R', 'L'])

const amountFromSuffix = (suffix: string): MoveAmount => {
  if (suffix === '') return 1
  if (suffix === '2') return 2
  if (suffix === "'") return 3
  throw new Error(`unknown move suffix "${suffix}"`)
}

const parseToken = (token: string): Move => {
  const match = MOVE_TOKEN_REGEX.exec(token)
  if (!match) throw new Error(`invalid move token: "${token}"`)

  // Uppercase face turn (with optional wide).
  if (match[1] !== undefined) {
    const axis = match[1] as MoveAxis
    const wide = match[2] === 'w'
    const amount = amountFromSuffix(match[3] ?? '')
    return { axis, wide, amount }
  }
  // Lowercase face = wide shorthand (e.g. r ≡ Rw, u ≡ Uw).
  if (match[4] !== undefined) {
    const axis = match[4].toUpperCase() as MoveAxis
    const amount = amountFromSuffix(match[5] ?? '')
    return { axis, wide: true, amount }
  }
  // Slice (M/E/S).
  if (match[6] !== undefined) {
    return { axis: match[6] as MoveAxis, wide: false, amount: amountFromSuffix(match[7] ?? '') }
  }
  // Rotation (x/y/z).
  if (match[8] !== undefined) {
    return { axis: match[8] as MoveAxis, wide: false, amount: amountFromSuffix(match[9] ?? '') }
  }
  throw new Error(`unhandled move token branch: "${token}"`)
}

export const parseAlgorithm = (input: string): Algorithm => {
  const trimmed = input.trim()
  if (trimmed.length === 0) return []
  const tokens = trimmed.split(/\s+/)
  return tokens.map(parseToken)
}

export const formatMove = (move: Move): string => {
  const wide = move.wide && FACE_AXES.has(move.axis) ? 'w' : ''
  const suffix = move.amount === 1 ? '' : move.amount === 2 ? '2' : "'"
  return `${move.axis}${wide}${suffix}`
}

export const formatAlgorithm = (alg: Algorithm): string => alg.map(formatMove).join(' ')
