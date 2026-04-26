'use client'

import { LEARNING_STATUSES, type LearningStatus, type UserAlgorithm } from '@rubik/shared'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDeleteAlgorithm } from '@/features/me/use-delete-algorithm'
import { useUpdateAlgorithm } from '@/features/me/use-update-algorithm'

interface Props {
  caseId: string
  caseSlug: string
  initialAlgorithm: UserAlgorithm | null
}

const NOT_TRACKED = 'not-tracked' as const
type Choice = LearningStatus | typeof NOT_TRACKED

export const TrackCaseButton = ({ caseId, caseSlug, initialAlgorithm }: Props) => {
  const [current, setCurrent] = useState<Choice>(
    initialAlgorithm?.status ?? NOT_TRACKED,
  )
  const update = useUpdateAlgorithm()
  const del = useDeleteAlgorithm()

  const onChange = (next: Choice) => {
    const previous = current
    setCurrent(next)
    if (next === NOT_TRACKED) {
      del.mutate(
        { caseId, caseSlug },
        {
          onSuccess: () => toast.success('Removed from tracking'),
          onError: () => {
            setCurrent(previous)
            toast.error('Failed to remove')
          },
        },
      )
    } else {
      update.mutate(
        { caseId, caseSlug, status: next },
        {
          onSuccess: () => toast.success(`Marked as ${next}`),
          onError: () => {
            setCurrent(previous)
            toast.error('Failed to update')
          },
        },
      )
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Track:</span>
      <Select
        value={current}
        onValueChange={(v) => onChange(v as Choice)}
        disabled={update.isPending || del.isPending}
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NOT_TRACKED}>Not tracked</SelectItem>
          {LEARNING_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
