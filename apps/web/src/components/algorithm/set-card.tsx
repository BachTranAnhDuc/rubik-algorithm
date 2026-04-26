import type { AlgorithmSet } from '@rubik/shared'
import type { Route } from 'next'
import Link from 'next/link'

interface SetCardProps {
  set: AlgorithmSet
  puzzleSlug: string
  methodSlug: string
}

export const SetCard = ({ set, puzzleSlug, methodSlug }: SetCardProps) => (
  <li>
    <Link
      href={`/${puzzleSlug}/${methodSlug}/${set.slug}` as Route}
      className="block rounded-lg border border-border bg-card p-4 text-card-foreground transition-colors hover:bg-accent"
    >
      <h3 className="text-lg font-semibold">{set.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {set.caseCountExpected} cases
      </p>
    </Link>
  </li>
)
