export type InsightTone = 'positive' | 'negative' | 'neutral'

export interface Insight {
  readonly title: string
  readonly description: string
  readonly tone: InsightTone
  readonly explanation: string
}
