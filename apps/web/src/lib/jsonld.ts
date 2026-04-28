import { moveToProse } from './notation-prose'

interface CaseJsonLdInput {
  displayName: string
  url: string
  description: string
  primaryNotation: string
}

const MIN_TOTAL_TIME_SECONDS = 2

export const caseHowToJsonLd = (input: CaseJsonLdInput) => {
  const moves = input.primaryNotation.split(/\s+/).filter(Boolean)
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `Solve the ${input.displayName} case`,
    description: input.description,
    url: input.url,
    totalTime: `PT${Math.max(MIN_TOTAL_TIME_SECONDS, moves.length)}S`,
    step: moves.map((move, idx) => ({
      '@type': 'HowToStep',
      position: idx + 1,
      name: move,
      text: moveToProse(move),
    })),
  }
}
