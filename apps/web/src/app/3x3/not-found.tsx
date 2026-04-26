import { Button } from '@/components/ui/button'

export default function CatalogNotFound() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold">Not in the catalog</h1>
      <p className="max-w-md text-muted-foreground">
        We couldn&apos;t find that puzzle, method, set, or case. Pick something from the
        catalog to keep browsing.
      </p>
      <Button asChild>
        <a href="/3x3">Browse the catalog</a>
      </Button>
    </main>
  )
}
