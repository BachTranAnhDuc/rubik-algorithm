const MS_PER_SECOND = 1000
const MS_PER_MINUTE = 60 * MS_PER_SECOND
const CENTI_PER_MS = 0.1

export const formatMs = (ms: number): string => {
  if (ms < 0) return '0.00'
  const minutes = Math.floor(ms / MS_PER_MINUTE)
  const remainder = ms - minutes * MS_PER_MINUTE
  const seconds = Math.floor(remainder / MS_PER_SECOND)
  const centis = Math.floor((remainder - seconds * MS_PER_SECOND) * CENTI_PER_MS)
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`
  }
  return `${seconds}.${String(centis).padStart(2, '0')}`
}

export const formatPenalty = (p: 'OK' | 'PLUS_TWO' | 'DNF'): string => {
  if (p === 'PLUS_TWO') return '+2'
  if (p === 'DNF') return 'DNF'
  return ''
}
