const FACE_NAMES: Record<string, string> = {
  U: 'top',
  D: 'bottom',
  R: 'right',
  L: 'left',
  F: 'front',
  B: 'back',
  M: 'middle (M-slice)',
  E: 'equatorial (E-slice)',
  S: 'standing (S-slice)',
  x: 'whole cube on R',
  y: 'whole cube on U',
  z: 'whole cube on F',
}

export const moveToProse = (move: string): string => {
  const trimmed = move.trim()
  if (trimmed.length === 0) return ''
  const head = trimmed[0]!
  const isCounter = trimmed.includes("'")
  const isDouble = trimmed.includes('2')
  const isWide = trimmed.toLowerCase().endsWith('w') || /^[a-z]$/.test(head)
  const upper = head.toUpperCase()
  const face = FACE_NAMES[upper] ?? upper
  if (isDouble) return `Rotate the ${face} face 180°.`
  const direction = isCounter ? 'counter-clockwise' : 'clockwise'
  const wide = isWide ? ' (wide turn)' : ''
  return `Rotate the ${face} face${wide} ${direction}.`
}
