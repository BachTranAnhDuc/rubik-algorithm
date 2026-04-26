import type { Method } from '@rubik/shared'

interface MethodCardProps {
  method: Method
  puzzleSlug: string
}

export const MethodCard = ({ method, puzzleSlug }: MethodCardProps) => (
  <li>
    <a
      href={`/${puzzleSlug}/${method.slug}`}
      className="block rounded-lg border border-border bg-card p-4 text-card-foreground transition-colors hover:bg-accent"
    >
      <h3 className="text-lg font-semibold">{method.name}</h3>
      {method.descriptionMd ? (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {method.descriptionMd}
        </p>
      ) : null}
    </a>
  </li>
)
