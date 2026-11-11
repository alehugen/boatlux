# Boatlux · DRE

Painel do fechamento financeiro da **Boatlux** e da **RS Náutica**. Importe a planilha de fechamento de cada operação e veja a DRE recalculada por regime e unidade (ou banco), indicadores, pontos de análise, meta de lucro, gráficos, dívidas e estoque.

Todo o processamento acontece **no navegador**, e nenhum dado é enviado para servidores.

> A planilha fica só na memória do navegador: ao recarregar a página, é preciso importá-la de novo.

## Como usar

1. Arraste a planilha de fechamento (`.xlsx`) para a página inicial.
2. A operação é reconhecida pela planilha, e a DRE abre no último mês encerrado, no regime e no filtro que estavam escolhidos nela.
3. As duas operações podem ficar abertas ao mesmo tempo: o seletor **Boatlux | RS Náutica** no cabeçalho alterna entre elas. Importar outra planilha da mesma operação substitui a anterior.

## Funcionalidades

- **Regime e unidade:** como os seletores B2 e B3 da aba DRE Unidades, a DRE pode ser vista em **Caixa** ou **Competência**, por unidade (Repasse, Comercial, GC...) ou com **todas as unidades** somadas. Os valores são recalculados no navegador a partir do fluxo de caixa, seguindo as fórmulas de cada mês da DRE.
- **Indicadores:** receita bruta, lucro bruto, margem de contribuição, EBITDA, resultado líquido e saldo de caixa, com margem e variação frente ao período anterior. Na competência o saldo de caixa não aparece, porque o saldo inicial só existe no caixa.
- **Só meses encerrados:** o mês atual, os seguintes e meses sem movimento ficam de fora.
- **Lançamentos fora da DRE:** aviso com os lançamentos do período que a DRE deixa de fora, com o motivo: sem categoria (a classificação não está na aba Lista), categoria que não é conta da DRE, sem unidade (fora da DRE de qualquer unidade) ou, na competência, sem data de emissão.
- **Continuidade do saldo:** aviso quando o saldo inicial de um mês não é o saldo final do mês anterior.
- **Pontos de análise** em linguagem de negócio, incluindo o ponto de equilíbrio.
- **Meta de lucro:** quanto faturar por mês para atingir um lucro escolhido, em slides.
- **De cada R$ 100 vendidos:** a receita dividida entre impostos, custos, despesas e o que sobra (EBITDA).
- **Gráficos:** para onde vai a receita, composição da receita e saldo de caixa.
- **DRE completa** com grupos recolhíveis, valores (R$) ou AV%, escolha dos meses e tela cheia. Clicar em um valor abre os lançamentos que o compõem.
- **Dívidas e estoque:** saldo devedor, parcelas do mês e última parcela de cada dívida; cotas em estoque agrupadas por embarcação.
- **Menu de seções** fixo ao lado do conteúdo (no celular, uma faixa no topo), destacando a seção na tela.
- **Filtros fixos:** ao rolar, regime, unidade e período continuam numa barra fixa no topo.
- Filtro por mês ou acumulado do ano. A planilha é lida num Web Worker, sem travar a tela.

## Formato da planilha

Há dois modelos, reconhecidos pela aba da DRE:

| Modelo | Aba da DRE | Filtros no topo da aba | Filtro da DRE |
|---|---|---|---|
| Boatlux | DRE Unidades | B2 regime, B3 unidade | Unidade, em caixa e competência |
| RS Náutica | DRE Geral | B1 regime, B2 banco (TODAS, Santander PJ, Sicredi...) | Banco, só em caixa (na competência os lançamentos não têm banco e a planilha soma todos) |

A Boatlux vale quando a DRE Unidades tem receita; a planilha da RS também tem uma DRE Unidades, mas zerada. Na RS, a categoria do fluxo de caixa fica na coluna "Classificações" e o saldo de caixa é o "Saldo final" logo depois do "Saldo inicial" (o "SALDO FINAL" acima dele é o resultado do mês).


- **DRE Unidades** (Boatlux) ou **DRE Geral** (RS Náutica): seletores de regime (B2) e unidade (B3), linha dos meses (1 a 12) com a dos anos logo abaixo e a linha "Receita operacional bruta". Os blocos são separados por linhas em branco: um bloco de uma linha é um **resultado**, um cabeçalho igual à soma das linhas abaixo é um **grupo**, e um cabeçalho seguido de outro título em maiúsculas é uma **seção**. A coluna "Acumulado" é ignorada. Sem a linha "Saldo inicial", o "Saldo final" é tratado como resultado do mês (soma no acumulado) e o saldo de caixa não aparece.
- As contas somam o fluxo de caixa com `SOMASES`/`SUMIFS` pela coluna **Categoria**, com a mesma regra do Excel: maiúsculas não importam, acentos e espaços sim. Totais e resultados seguem as fórmulas `SOMA`, `+` e `−` de cada mês. Uma célula com valor digitado mantém o valor da planilha em qualquer regime (a página avisa).
- **Fluxo de Caixa**: colunas Categoria, Valor de movimento (ou Valor e Movimentação), Data pagto, Mês/Ano Cx., Data de emissão, Mês/Ano Comp., Banco, Classificação C.A, Histórico e Unidade.
- **Dívidas**: aba com "Dívida" no nome, uma linha por dívida, a coluna "Saldo" e uma coluna por mês (`mm/aaaa`) com a parcela. A leitura para na linha "Total"; o total do app soma todas as dívidas.
- **Estoque**: aba com "Estoque" no nome, com as colunas "Cotas disponíveis" e "Valor da cota". O código antes do traço agrupa as cotas por embarcação (J = jet ski, L = lancha).
- Arquivos vazios ou acima de 25 MB são recusados.

## Começando

**Pré-requisitos:** Node.js `20.19+` ou `22.12+`.

```bash
npm install
npm run dev
```

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com hot reload |
| `npm run build` | Checagem de tipos (`vue-tsc`) e build de produção em `dist/` |
| `npm run preview` | Serve o build de produção localmente |
| `npm test` | Roda os testes uma vez |
| `npm run test:watch` | Roda os testes em modo observação |
| `npm run coverage` | Testes com relatório de cobertura e limites mínimos |

## Stack

| Área | Tecnologia |
|---|---|
| Base | Vue 3, TypeScript, Vite |
| Componentes | [shadcn-vue](https://www.shadcn-vue.com/) sobre [Reka UI](https://reka-ui.com/) |
| Estilo | Tailwind CSS 4, com tokens de tema claro e escuro |
| Estado e rotas | Pinia, Vue Router |
| Leitura de arquivos | [SheetJS](https://sheetjs.com/) (XLSX/XLS), instalada pelo CDN oficial |
| Gráficos | [ECharts](https://echarts.apache.org/) + vue-echarts |
| Ícones | [Phosphor Icons](https://phosphoricons.com/) |
| Fonte | WeezerFont, a fonte do site da marca (`src/assets/fonts/`) |
| Testes | [Vitest](https://vitest.dev/), Vue Test Utils, happy-dom |

## Design system

Os tokens ficam em `src/presentation/main.css` e seguem a identidade do site [boatlux.com.br](https://boatlux.com.br/):

| Token | Cor | Papel |
|---|---|---|
| `brand-deep` / `band` | `#00244F` | Cabeçalho e faixa "casco" no topo das páginas (igual nos dois temas) |
| `brand-navy` / `primary` | `#0B4976` | Botões, texto forte e linhas de resultado da DRE (tema claro) |
| `brand-cyan` / `water` | `#12BFF9` | Período selecionado, o que sobra da receita e linhas de resultado (tema escuro) |
| `brand-sky` | `#7EC1F3` | Azul de apoio |
| `brand-mist` | `#F4F8FB` | Fundo claro |

- **Tema claro** é o padrão; o escuro usa fundos em marinho profundo e destaque ciano.
- **Superfícies:** cards de indicadores, pontos de análise, gráficos e tabelas usam o utilitário `surface` (borda suave, cantos de 0,7rem e elevação em camadas `--elevation-1..3`).
- **Fonte:** WeezerFont, a mesma de títulos e textos do site [boatluxsc.com.br](https://www.boatluxsc.com.br/). Só tem peso regular, então a hierarquia vem de tamanho e cor.
- **Logo:** versão branca em `public/brand/`, usada no cabeçalho e na tela de carregamento.
- **Movimento:** a barra "De cada R$ 100" cresce em sequência na entrada, os valores principais contam até o novo número ao trocar de período e a troca de página anima só o conteúdo (as faixas marinho ficam sólidas). Tudo respeita o movimento reduzido do sistema.
- Os gráficos usam dois azuis da marca nas primeiras séries (`useChartTheme.ts`).

## Arquitetura

Arquitetura limpa com DDD. A regra de dependência é **`presentation → application → domain`**. A camada `infrastructure` implementa a leitura do arquivo e só é conhecida pelo `container.ts`.

```
src/
├── domain/                 # Regras de negócio puras (sem Vue nem bibliotecas)
│   ├── shared.ts           # Period, parseNumber, ratio, relativeChange...
│   ├── ingestion/          # SourceFile, RawTable, porta FileParser, leitura de cabeçalhos
│   ├── dre/                # DreReport (DRE recalculada), DreLayout (modelos Boatlux e RS), DreBasis (regime e filtro), DreFormula, Ledger
│   ├── debts/              # Cronograma e situação das dívidas
│   ├── stock/              # Cotas em estoque
│   └── analysis/           # Insight (pontos de análise)
├── application/            # Casos de uso: importar a planilha e analisar a DRE
├── infrastructure/         # Leitura do XLSX (Web Worker com fallback)
│   └── container.ts        # Composition root (injeção de dependências)
├── presentation/           # Vue
│   ├── components/         # Gráficos, cards, avisos e tabelas
│   │   └── ui/             # Componentes do shadcn-vue
│   ├── composables/        # useReport (planilha aberta), useDreAnalysis...
│   ├── pages/              # Início (importação), DRE e página não encontrada
│   ├── router.ts
│   ├── format.ts           # Formatadores pt-BR
│   └── main.css            # Tailwind, tokens da marca e animações
├── test/                   # Testes, espelhando as camadas
├── App.vue
└── main.ts
```

Para adicionar componentes do shadcn-vue: `npx shadcn-vue@latest add <componente>`.

## Testes

A suíte fica em `src/test/`, separada por camada (domínio, aplicação e apresentação). Os dados de teste são **sintéticos** (`src/test/fixtures.ts`) e reproduzem a estrutura da DRE sem expor dados reais.
