export const LEARNING_STATUSES = ['LEARNING', 'LEARNED', 'MASTERED'] as const

export type LearningStatusValue = (typeof LEARNING_STATUSES)[number]

export const isLearningStatus = (value: string): value is LearningStatusValue =>
  (LEARNING_STATUSES as readonly string[]).includes(value)
