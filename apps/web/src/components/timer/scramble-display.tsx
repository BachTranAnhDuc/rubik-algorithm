'use client'

interface Props {
  scramble: string | null
  isHidden: boolean
  isLoading: boolean
}

export const ScrambleDisplay = ({ scramble, isHidden, isLoading }: Props) => {
  if (isHidden) {
    return (
      <p className="text-center font-mono text-lg text-muted-foreground">
        Solve in progress…
      </p>
    )
  }
  if (isLoading || !scramble) {
    return (
      <p className="text-center font-mono text-lg text-muted-foreground">
        Loading scramble…
      </p>
    )
  }
  return (
    <p
      className="break-words text-center font-mono text-lg text-foreground md:text-xl"
      aria-label={`Scramble: ${scramble}`}
    >
      {scramble}
    </p>
  )
}
