import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'

export type SortValue = string | number | null | undefined
export type SortDirection = 'asc' | 'desc'
export type SortAccessors<T> = Record<string, (row: T) => SortValue>

export interface TableSort<T = unknown> {
  readonly key: string | null
  readonly direction: SortDirection
  readonly rows: readonly T[]
  toggle(column: string): void
  ariaSort(column: string): 'ascending' | 'descending' | 'none'
}

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

const isEmpty = (value: SortValue) =>
  value === null || value === undefined || value === '' || (typeof value === 'number' && Number.isNaN(value))

export function compareSortValues(a: SortValue, b: SortValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return collator.compare(String(a), String(b))
}

export function useTableSort<T>(
  rows: MaybeRefOrGetter<readonly T[]>,
  accessors: MaybeRefOrGetter<SortAccessors<T>>,
): TableSort<T> {
  const key = ref<string | null>(null)
  const direction = ref<SortDirection>('asc')

  const accessorOf = (column: string | null) => (column ? toValue(accessors)[column] : undefined)

  const firstDirection = (column: string): SortDirection => {
    const pick = accessorOf(column)
    const sample = pick && toValue(rows).map(pick).find((value) => !isEmpty(value))
    return typeof sample === 'number' ? 'desc' : 'asc'
  }

  const sorted = computed(() => {
    const list = toValue(rows)
    const pick = accessorOf(key.value)
    if (!pick) return list
    const sign = direction.value === 'asc' ? 1 : -1
    return list
      .map((row, index) => ({ row, index, value: pick(row) }))
      .sort((a, b) => {
        const emptyA = isEmpty(a.value)
        const emptyB = isEmpty(b.value)
        if (emptyA || emptyB) return emptyA === emptyB ? a.index - b.index : emptyA ? 1 : -1
        return compareSortValues(a.value, b.value) * sign || a.index - b.index
      })
      .map((entry) => entry.row)
  })

  return {
    get key() {
      return key.value
    },
    get direction() {
      return direction.value
    },
    get rows() {
      return sorted.value
    },
    toggle(column) {
      const first = firstDirection(column)
      if (key.value !== column) {
        key.value = column
        direction.value = first
      } else if (direction.value === first) {
        direction.value = first === 'asc' ? 'desc' : 'asc'
      } else {
        key.value = null
      }
    },
    ariaSort(column) {
      if (key.value !== column) return 'none'
      return direction.value === 'asc' ? 'ascending' : 'descending'
    },
  }
}
