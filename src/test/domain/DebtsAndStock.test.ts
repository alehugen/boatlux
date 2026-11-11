import { describe, expect, it } from 'vitest'
import { debtOverview, readDebts } from '@/domain/debts'
import { DreReport } from '@/domain/dre'
import { movementOf, readStock } from '@/domain/stock'
import { DEBT_ROWS, dreRows, STOCK_ROWS, STOCK_WITH_SOLD_ROWS } from '@/test/fixtures'

const NOVEMBER = new Date(2026, 10, 7)

describe('readDebts', () => {
  const schedule = readDebts({ sheet: 'Dívidas  ', rows: DEBT_ROWS }, NOVEMBER)!

  it('lê cada dívida com o saldo da planilha e as parcelas por mês, até a linha de total', () => {
    expect(schedule.updatedAt).toBe('2026-10-01')
    expect(schedule.balanceFromSheet).toBe(true)
    expect(schedule.periods).toHaveLength(4)
    expect(schedule.debts.map((debt) => [debt.label, debt.balance])).toEqual([
      ['Empréstimo banco', 3000],
      ['Financiamento lancha', 9000],
    ])
    expect(schedule.debts[1]!.installments).toEqual([0, 3000, 3000, 3000])
  })

  it('resume o saldo, as parcelas do mês e a última parcela', () => {
    const overview = debtOverview(schedule, NOVEMBER)
    expect(overview).toMatchObject({ reference: { year: 2026, month: 11 }, balance: 12000, installment: 4000, payoff: { year: 2027, month: 1 } })
    expect(overview.debts.map((debt) => debt.label)).toEqual(['Financiamento lancha', 'Empréstimo banco'])
    expect(overview.debts[1]!.payoff).toEqual({ year: 2026, month: 12 })
  })

  it('sem coluna de saldo, soma as parcelas do mês atual em diante', () => {
    const rows = DEBT_ROWS.map((row) => [row[0]!, ...row.slice(2)])
    const own = readDebts({ sheet: 'Dívidas', rows }, NOVEMBER)!
    expect(own.balanceFromSheet).toBe(false)
    expect(own.debts.map((debt) => debt.balance)).toEqual([2000, 9000])
  })

  it('só lê abas de dívidas com cronograma mensal', () => {
    expect(readDebts({ sheet: 'Planejamento', rows: DEBT_ROWS })).toBeNull()
    expect(readDebts({ sheet: 'Dívidas', rows: [['Dívida', 'Saldo'], ['A', '10']] })).toBeNull()
    expect(readDebts({ sheet: 'Dívidas', rows: [DEBT_ROWS[0]!, ['A', '0', '', '', '', '']] })).toBeNull()
  })

  it('não aponta quitação para dívidas já encerradas', () => {
    const overview = debtOverview(schedule, new Date(2027, 5, 1))
    expect(overview.installment).toBe(0)
    expect(overview.payoff).toBeNull()
  })
})

describe('readStock', () => {
  const stock = readStock({ sheet: 'Estoque', rows: STOCK_ROWS })!

  it('lê as cotas e agrupa pela embarcação', () => {
    expect(stock.items).toHaveLength(5)
    expect(stock.total).toBe(545000)
    expect(stock.groups.map((group) => [group.label, group.items.length, group.total])).toEqual([
      ['J12', 1, 12000],
      ['L29', 2, 290000],
      ['L31', 2, 243000],
    ])
  })

  it('só lê a aba de estoque', () => {
    expect(readStock({ sheet: 'Lista', rows: STOCK_ROWS })).toBeNull()
    expect(readStock({ sheet: 'Estoque', rows: [['Nome', 'Quantidade']] })).toBeNull()
    expect(readStock({ sheet: 'Estoque', rows: [STOCK_ROWS[0]!] })).toBeNull()
  })
})

describe('readStock com a lista de vendidas', () => {
  const stock = readStock({ sheet: 'Estoque', rows: STOCK_WITH_SOLD_ROWS })!

  it('tira do estoque as cotas que estão na lista de vendidas', () => {
    expect(stock.items.map((item) => item.label)).toEqual(['L29 - 01', 'L29 - 02', 'L31 - 06'])
    expect(stock.total).toBe(404000)
  })

  it('lê as vendidas com a observação; trocas ficam fora do total', () => {
    const sold = stock.sold!
    expect(sold.items).toHaveLength(6)
    expect(sold.total).toBe(465000)
    expect(sold.sales).toBe(5)
    expect(sold.groups.map((group) => [group.label, group.total, group.exchanged])).toEqual([
      ['J12', 12000, 0],
      ['L13', 0, 69000],
      ['L31', 453000, 0],
    ])
    expect(sold.items.find((item) => item.label === 'L13')!.movement).toEqual({ kind: 'exchange', from: 'L20' })
    expect(sold.items.find((item) => item.label === 'L31 - 01')!.movement).toEqual({ kind: 'upgrade', from: 'L20' })
  })

  it.each([
    ['upgrade L20', { kind: 'upgrade', from: 'L20' }],
    ['Upgrade da L 20', { kind: 'upgrade', from: 'L20' }],
    ['Troca (L20)', { kind: 'exchange', from: 'L20' }],
    ['troca pela J12', { kind: 'exchange', from: 'J12' }],
    ['Troca', { kind: 'exchange', from: '' }],
    ['pago à vista', null],
  ])('entende a observação "%s"', (note, movement) => {
    expect(movementOf(note)).toEqual(movement)
  })

  it('sem lista de vendidas, sold fica vazio', () => {
    expect(readStock({ sheet: 'Estoque', rows: STOCK_ROWS })!.sold).toBeNull()
  })
})

describe('DreReport com dívidas e estoque', () => {
  it('junta as abas de dívidas e de estoque à DRE', () => {
    const report = DreReport.fromWorkbook([
        { sheet: 'DRE Unidades', rows: dreRows() },
        { sheet: 'Dívidas', rows: DEBT_ROWS },
        { sheet: 'Estoque', rows: STOCK_ROWS },
      ], { name: 'DRE', asOf: NOVEMBER })
    expect(report.debts?.debts).toHaveLength(2)
    expect(report.stock?.total).toBe(545000)
  })

  it('fica sem dívidas e estoque quando a planilha não tem essas abas', () => {
    const report = DreReport.fromWorkbook([{ sheet: 'DRE Unidades', rows: dreRows() }], { name: 'DRE', asOf: NOVEMBER })
    expect(report.debts).toBeNull()
    expect(report.stock).toBeNull()
  })
})
