export const RECOGNITION_BASES = [
  'LAST_LAYER',
  'F2L_SLOT',
  'OLL_ORIENTATION',
  'PLL_PERMUTATION',
  'CROSS',
  'OTHER',
] as const

export type RecognitionBasisValue = (typeof RECOGNITION_BASES)[number]

export const isRecognitionBasis = (value: string): value is RecognitionBasisValue =>
  (RECOGNITION_BASES as readonly string[]).includes(value)
