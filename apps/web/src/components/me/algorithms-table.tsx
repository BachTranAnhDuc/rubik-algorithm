'use client'

import { LEARNING_STATUSES, type LearningStatus } from '@rubik/shared'
import { Trash2 } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { CaseLocation } from '@/features/catalog/catalog-fetchers'
import { useDeleteAlgorithm } from '@/features/me/use-delete-algorithm'
import { useMyAlgorithms } from '@/features/me/use-my-algorithms'
import { useUpdateAlgorithm } from '@/features/me/use-update-algorithm'

import { EmptyState } from './empty-state'

interface Props {
  casesById: Record<string, CaseLocation>
}

const MIN_DIFF_MS = 60_000
const HOUR_MS = 60 * MIN_DIFF_MS
const DAY_MS = 24 * HOUR_MS

const formatRelative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < MIN_DIFF_MS) return 'just now'
  if (diff < HOUR_MS) return `${Math.round(diff / MIN_DIFF_MS)}m ago`
  if (diff < DAY_MS) return `${Math.round(diff / HOUR_MS)}h ago`
  return `${Math.round(diff / DAY_MS)}d ago`
}

export const AlgorithmsTable = ({ casesById }: Props) => {
  const { data, isLoading, error } = useMyAlgorithms()
  const update = useUpdateAlgorithm()
  const del = useDeleteAlgorithm()

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>
  if (error) {
    return (
      <p className="text-destructive">
        Failed to load. Try signing in again.
      </p>
    )
  }
  if (!data || data.length === 0) return <EmptyState />

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Case</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => {
          const loc = casesById[row.caseId]
          if (!loc) return null
          const href =
            `/${loc.puzzleSlug}/${loc.methodSlug}/${loc.setSlug}/${loc.case.slug}` as Route
          return (
            <TableRow key={row.caseId}>
              <TableCell>
                <Link href={href} className="font-medium hover:underline">
                  {loc.case.displayName}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {loc.methodSlug} / {loc.setSlug}
                </div>
              </TableCell>
              <TableCell>
                <Select
                  value={row.status}
                  disabled={update.isPending}
                  onValueChange={(v) =>
                    update.mutate(
                      {
                        caseId: row.caseId,
                        caseSlug: loc.case.slug,
                        status: v as LearningStatus,
                      },
                      { onError: () => toast.error('Update failed') },
                    )
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEARNING_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatRelative(row.updatedAt)}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={del.isPending}
                  onClick={() =>
                    del.mutate(
                      { caseId: row.caseId, caseSlug: loc.case.slug },
                      { onError: () => toast.error('Delete failed') },
                    )
                  }
                  aria-label={`Untrack ${loc.case.displayName}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
