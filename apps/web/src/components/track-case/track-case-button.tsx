'use client'

import { LEARNING_STATUSES, type LearningStatus, type UserAlgorithm } from '@rubik/shared'
import { toast } from 'sonner'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDeleteAlgorithm } from '@/features/me/use-delete-algorithm'
import { useMyAlgorithms } from '@/features/me/use-my-algorithms'
import { useUpdateAlgorithm } from '@/features/me/use-update-algorithm'

interface Props {
  caseId: string
  caseSlug: string
  initialAlgorithm: UserAlgorithm | null
}

const NOT_TRACKED = 'not-tracked' as const
type Choice = LearningStatus | typeof NOT_TRACKED

export const TrackCaseButton = ({ caseId, caseSlug, initialAlgorithm }: Props) => {
  const { data } = useMyAlgorithms()
  const update = useUpdateAlgorithm()
  const del = useDeleteAlgorithm()

  const cached = data?.find((u) => u.caseId === caseId)?.status
  const current: Choice = cached ?? initialAlgorithm?.status ?? NOT_TRACKED

  const onChange = (next: Choice) => {
    if (next === NOT_TRACKED) {
      del.mutate(
        { caseId, caseSlug },
        {
          onSuccess: () => toast.success('Removed from tracking'),
          onError: () => toast.error('Failed to remove'),
        },
      )
    } else {
      update.mutate(
        { caseId, caseSlug, status: next },
        {
          onSuccess: () => toast.success(`Marked as ${next}`),
          onError: () => toast.error('Failed to update'),
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
