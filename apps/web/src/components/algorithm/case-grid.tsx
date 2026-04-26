import type { AlgorithmCase, RecognitionBasis } from '@rubik/shared'

import { CaseCard } from './case-card'

interface CaseGridProps {
  cases: AlgorithmCase[]
  recognitionBasis: RecognitionBasis
  puzzleSlug: string
  methodSlug: string
  setSlug: string
}

export const CaseGrid = ({
  cases,
  recognitionBasis,
  puzzleSlug,
  methodSlug,
  setSlug,
}: CaseGridProps) => (
  <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
    {cases.map((c) => (
      <CaseCard
        key={c.slug}
        case={c}
        recognitionBasis={recognitionBasis}
        puzzleSlug={puzzleSlug}
        methodSlug={methodSlug}
        setSlug={setSlug}
      />
    ))}
  </ul>
)
