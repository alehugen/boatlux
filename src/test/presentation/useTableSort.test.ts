import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { compareSortValues, useTableSort } from '@/presentation/composables/useTableSort'

interface Item {
  name: string
  value: number | null
}

const items: Item[] = [
  { name: 'Banana', value: 30 },
  { name: 'abacaxi', value: null },
  { name: 'Ágata', value: 10 },
  { name: 'Item 10', value: 20 },
  { name: 'Item 2', value: 30 },
]

const sortItems = (rows = ref(items)) =>
  useTableSort(rows, { name: (item) => item.name, value: (item) => item.value })

describe('useTableSort', () => {
  it('mantém a ordem original até escolher uma coluna', () => {
    expect(sortItems().rows).toEqual(items)
  })

  it('ordena números do maior para o menor primeiro, depois inverte e por fim volta à ordem original', () => {
    const sort = sortItems()
    sort.toggle('value')
    expect(sort.rows.map((item) => item.value)).toEqual([30, 30, 20, 10, null])
    expect(sort.rows.slice(0, 2).map((item) => item.name)).toEqual(['Banana', 'Item 2'])
    expect(sort.ariaSort('value')).toBe('descending')

    sort.toggle('value')
    expect(sort.rows.map((item) => item.value)).toEqual([10, 20, 30, 30, null])
    expect(sort.ariaSort('value')).toBe('ascending')

    sort.toggle('value')
    expect(sort.key).toBeNull()
    expect(sort.rows).toEqual(items)
    expect(sort.ariaSort('value')).toBe('none')
  })

  it('ordena texto de A a Z primeiro, ignorando acentos e maiúsculas e respeitando números no texto', () => {
    const sort = sortItems()
    sort.toggle('name')
    expect(sort.rows.map((item) => item.name)).toEqual(['abacaxi', 'Ágata', 'Banana', 'Item 2', 'Item 10'])
    expect(sort.ariaSort('name')).toBe('ascending')
    expect(sort.ariaSort('value')).toBe('none')
  })

  it('troca de coluna recomeçando pela direção natural dela', () => {
    const sort = sortItems()
    sort.toggle('name')
    sort.toggle('name')
    sort.toggle('value')
    expect(sort.direction).toBe('desc')
  })

  it('reordena quando os dados mudam e ignora colunas desconhecidas', () => {
    const rows = ref<Item[]>([{ name: 'B', value: 1 }])
    const sort = sortItems(rows)
    sort.toggle('value')
    rows.value = [...rows.value, { name: 'A', value: 5 }]
    expect(sort.rows.map((item) => item.name)).toEqual(['A', 'B'])

    sort.toggle('inexistente')
    expect(sort.rows.map((item) => item.name)).toEqual(['B', 'A'])
  })

  it('compara números como números e o resto como texto', () => {
    expect(compareSortValues(2, 10)).toBeLessThan(0)
    expect(compareSortValues('2', '10')).toBeLessThan(0)
    expect(compareSortValues('b', 'A')).toBeGreaterThan(0)
  })
})
