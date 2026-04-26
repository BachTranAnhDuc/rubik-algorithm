import type { AlgorithmVariant } from '@rubik/shared'

interface VariantListProps {
  variants: AlgorithmVariant[]
}

const sortVariants = (variants: AlgorithmVariant[]): AlgorithmVariant[] =>
  [...variants].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
    return a.displayOrder - b.displayOrder
  })

export const VariantList = ({ variants }: VariantListProps) => {
  const sorted = sortVariants(variants)
  return (
    <ul className="flex flex-col gap-3">
      {sorted.map((v) => (
        <li
          key={v.id}
          className={`rounded-lg border p-4 ${
            v.isPrimary ? 'border-primary bg-primary/5' : 'border-border bg-card'
          }`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <code className="font-mono text-sm">{v.notation}</code>
            <span className="text-xs text-muted-foreground">
              {v.moveCountHtm} HTM · {v.moveCountStm} STM
              {v.isPrimary ? ' · primary' : ''}
            </span>
          </div>
          {v.attribution ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Attribution: {v.attribution}
            </p>
          ) : null}
          {v.fingertrickMd ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium">
                Fingertricks
              </summary>
              <p className="mt-2 text-sm leading-relaxed">{v.fingertrickMd}</p>
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
