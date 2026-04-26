import type { AlgorithmCase, RecognitionBasis } from '@rubik/shared'

import { CubeStateDiagram } from '@/components/cube/cube-state-diagram'

interface CaseCardProps {
  case: AlgorithmCase
  recognitionBasis: RecognitionBasis
  puzzleSlug: string
  methodSlug: string
  setSlug: string
}

const THUMBNAIL_SIZE = 120

export const CaseCard = ({
  case: c,
  recognitionBasis,
  puzzleSlug,
  methodSlug,
  setSlug,
}: CaseCardProps) => (
  <li>
    <a
      href={`/${puzzleSlug}/${methodSlug}/${setSlug}/${c.slug}`}
      className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3 text-card-foreground transition-colors hover:bg-accent"
    >
      <CubeStateDiagram
        caseState={c.caseState}
        recognitionBasis={recognitionBasis}
        size={THUMBNAIL_SIZE}
        title={c.displayName}
      />
      <span className="text-sm font-medium">{c.displayName}</span>
    </a>
  </li>
)
