// Sticker color palette for the standard 3x3 Rubik's color scheme. Domain
// tokens — not theme tokens — they don't flip with light/dark mode.
//
// `n` = blank/masked sticker (rendered as neutral gray).
// `t` = transparent sticker (rendered as zero-opacity slot).
//
// Source: WCA-recommended cube color scheme.
export const STICKER_COLORS = {
  U: '#ffffff',
  D: '#ffd000',
  F: '#00a651',
  B: '#0046ad',
  L: '#ff8a00',
  R: '#c41e3a',
  n: '#5c5f66',
  t: 'transparent',
} as const

export type StickerCharacter = keyof typeof STICKER_COLORS

export const STROKE_COLOR = '#0a0a0a'
export const BACKGROUND_COLOR = '#1a1a1a'

export const colorForSticker = (ch: string): string => {
  if (ch in STICKER_COLORS) return STICKER_COLORS[ch as StickerCharacter]
  return STICKER_COLORS.n
}
