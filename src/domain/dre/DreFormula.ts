/**
 * Como recalcular uma linha da DRE, lido da fórmula da planilha:
 * - `ledger`: soma os lançamentos do fluxo de caixa com a categoria da linha (SOMASES);
 * - `sum`: combina outras linhas da DRE (SOMA de intervalos, + e −);
 * - `blank`: linha sem fórmula e sem valor (fica zerada);
 * - `fixed`: valor digitado ou fórmula desconhecida (mantém o valor da planilha).
 */
export type LineRecipe =
  | { readonly type: 'ledger' }
  | { readonly type: 'sum'; readonly terms: readonly { readonly row: number; readonly sign: number }[]; readonly constant: number }
  | { readonly type: 'blank' }
  | { readonly type: 'fixed' }

const LEDGER_FUNCTIONS = /\b(SUMIFS?|SOMASES?)\s*\(/i

/** Letras da coluna (0 → A, 27 → AB). */
export function columnLetters(index: number): string {
  let letters = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters
  return letters
}

/**
 * Interpreta a fórmula de uma linha da DRE. `column` é a coluna da fórmula (A1, base zero), e as linhas
 * retornadas também são de base zero, como nas tabelas lidas.
 */
export function parseLineFormula(formula: string | undefined, column: number, hasValue: boolean): LineRecipe {
  if (!formula?.trim()) return hasValue ? { type: 'fixed' } : { type: 'blank' }
  if (LEDGER_FUNCTIONS.test(formula)) return { type: 'ledger' }
  const parsed = new SumParser(formula.replace(/^=/, ''), columnLetters(column)).parse()
  return parsed ? { type: 'sum', ...parsed } : { type: 'fixed' }
}

type Terms = { terms: { row: number; sign: number }[]; constant: number }

/** Analisador de expressões com SOMA, intervalos e referências da mesma coluna: `SUM(C5:C9)+C12-C14`. */
class SumParser {
  private position = 0
  private readonly text: string
  private readonly column: string

  constructor(text: string, column: string) {
    this.text = text.replace(/\s+/g, '').toUpperCase()
    this.column = column
  }

  parse(): Terms | null {
    try {
      const result = this.expression()
      return this.position === this.text.length ? result : null
    } catch {
      return null
    }
  }

  private expression(): Terms {
    const result = this.term()
    while (this.peek() === '+' || this.peek() === '-') {
      const sign = this.next() === '-' ? -1 : 1
      merge(result, this.term(), sign)
    }
    return result
  }

  private term(): Terms {
    if (this.peek() === '-' || this.peek() === '+') {
      const sign = this.next() === '-' ? -1 : 1
      return merge(empty(), this.term(), sign)
    }
    if (this.eat('SUM(') || this.eat('SOMA(')) {
      const result = this.expression()
      while (this.eat(',') || this.eat(';')) merge(result, this.expression(), 1)
      this.expect(')')
      return result
    }
    if (this.eat('(')) {
      const result = this.expression()
      this.expect(')')
      return result
    }
    const number = /^\d+(\.\d+)?/.exec(this.rest())
    if (number && !/^[A-Z]/.test(this.rest())) {
      this.position += number[0].length
      return { terms: [], constant: Number(number[0]) }
    }
    return this.reference()
  }

  private reference(): Terms {
    const first = this.cell()
    if (!this.eat(':')) return { terms: [{ row: first, sign: 1 }], constant: 0 }
    const last = this.cell()
    const terms = []
    for (let row = Math.min(first, last); row <= Math.max(first, last); row++) terms.push({ row, sign: 1 })
    return { terms, constant: 0 }
  }

  private cell(): number {
    const match = /^\$?([A-Z]{1,3})\$?(\d+)/.exec(this.rest())
    if (!match || match[1] !== this.column) throw new Error('referência fora da coluna')
    this.position += match[0].length
    return Number(match[2]) - 1
  }

  private rest = () => this.text.slice(this.position)
  private peek = () => this.text[this.position]
  private next = () => this.text[this.position++]
  private eat(token: string) {
    if (!this.text.startsWith(token, this.position)) return false
    this.position += token.length
    return true
  }
  private expect(token: string) {
    if (!this.eat(token)) throw new Error(`esperado ${token}`)
  }
}

const empty = (): Terms => ({ terms: [], constant: 0 })

function merge(target: Terms, source: Terms, sign: number): Terms {
  for (const term of source.terms) target.terms.push({ row: term.row, sign: term.sign * sign })
  target.constant += source.constant * sign
  return target
}
