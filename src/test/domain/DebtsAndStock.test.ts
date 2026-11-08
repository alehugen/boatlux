import { describe, expect, it } from 'vitest'
import { debtOverview, readDebts } from '@/domain/debts'
import { DreReport } from '@/domain/dre'
import { readStock } from '@/domain/stock'
import { DEBT_ROWS, dreRows, STOCK_ROWS } from '@/test/fixtures'

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

describe('DreReport com dívidas e estoque', () => {
  it('junta as abas de dívidas e de estoque à DRE', () => {
    const report = DreReport.fromWorkbook([
        { sheet: 'DRE Geral', rows: dreRows() },
        { sheet: 'Dívidas', rows: DEBT_ROWS },
        { sheet: 'Estoque', rows: STOCK_ROWS },
      ], { name: 'DRE', asOf: NOVEMBER })
    expect(report.debts?.debts).toHaveLength(2)
    expect(report.stock?.total).toBe(545000)
  })

  it('fica sem dívidas e estoque quando a planilha não tem essas abas', () => {
    const report = DreReport.fromWorkbook([{ sheet: 'DRE Geral', rows: dreRows() }], { name: 'DRE', asOf: NOVEMBER })
    expect(report.debts).toBeNull()
    expect(report.stock).toBeNull()
  })
})
