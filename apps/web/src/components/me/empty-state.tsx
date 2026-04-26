import Link from 'next/link'

import { Button } from '@/components/ui/button'

export const EmptyState = () => (
  <div className="rounded-lg border border-border bg-card p-12 text-center">
    <h2 className="mb-2 text-xl font-semibold">No algorithms tracked yet</h2>
    <p className="mb-6 text-muted-foreground">
      Visit a case page and pick a status to start tracking it here.
    </p>
    <Button asChild>
      <Link href="/3x3">Browse the catalog</Link>
    </Button>
  </div>
)
