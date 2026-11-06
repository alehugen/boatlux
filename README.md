# Boat Lux · DRE

Painel da DRE gerencial da **Boat Lux**. Importe a planilha da DRE e veja indicadores, pontos de análise, meta de lucro, gráficos e a DRE completa.

Todo o processamento acontece **no navegador**, e nenhum dado é enviado para servidores.

> Os dados ficam apenas na memória do navegador: ao recarregar a página, é preciso importar a planilha novamente.

## Como usar

1. Arraste a planilha da DRE (`.xlsx` ou `.xls`) para a página inicial.
2. A DRE abre direto no último mês encerrado. As DREs importadas ficam listadas na página inicial.

## Funcionalidades

- Lê a DRE gerencial mensal e reconstrói a hierarquia de contas (seções, grupos, contas e linhas de resultado).
- **Indicadores:** receita bruta, lucro bruto, margem de contribuição, EBITDA, resultado líquido e saldo de caixa, com margem e variação frente ao período anterior.
- **Só meses encerrados:** o mês atual, os seguintes e meses sem movimento ficam de fora.
- **Pontos de análise** em linguagem de negócio, incluindo o ponto de equilíbrio.
- **Meta de lucro:** quanto faturar por mês para atingir um lucro escolhido, em slides.
- **De cada R$ 100 vendidos:** no topo, a receita dividida entre impostos, custos, despesas e o que sobra (EBITDA); no prejuízo, mostra o quanto passou da receita.
- **Barra de período fixa:** ao rolar a página, o período e o resultado continuam visíveis no topo, com o seletor à mão.
- **Gráficos:** para onde vai a receita, composição da receita e saldo de caixa.
- **DRE completa** com grupos recolhíveis, valores (R$) ou AV%, escolha dos meses e tela cheia.
- **Composição de cada valor:** se a planilha tiver uma aba de fluxo de caixa, clicar em um valor abre os lançamentos que o compõem.
- Filtro por mês ou acumulado do ano.

## Formato da planilha

- Uma linha de meses (1 a 12) e, logo abaixo, a linha dos anos.
- Com várias abas, é usada a que contém **"DRE Geral"** no nome.
- É preciso existir a linha "Receita operacional bruta".
- Os blocos são separados por linhas em branco: um bloco de uma linha é um **resultado**, um cabeçalho igual à soma das linhas abaixo é um **grupo**, e um cabeçalho seguido de outro título em maiúsculas é uma **seção**.
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

Arquitetura limpa com DDD. A regra de dependência é **`presentation → application → domain`**. A camada `infrastructure` implementa as portas do domínio e só é conhecida pelo `container.ts`.

```
src/
├── domain/                 # Regras de negócio puras (sem Vue nem bibliotecas)
│   ├── shared.ts           # Period, parseNumber, ratio, relativeChange...
│   ├── report.ts           # Report, ReportRepository, recognizeReports
│   ├── ingestion/          # SourceFile, FileFormat, porta FileParser, leitura de cabeçalhos
│   ├── dre/                # DreReport (hierarquia da DRE) e Ledger (fluxo de caixa)
│   └── analysis/           # Insight (pontos de análise)
├── application/            # Casos de uso: importar, listar/remover e analisar a DRE
├── infrastructure/         # Leitor XLSX, repositório em memória
│   └── container.ts        # Composition root (injeção de dependências)
├── presentation/           # Vue
│   ├── components/         # Gráficos, cards e tabelas
│   │   └── ui/             # Componentes do shadcn-vue
│   ├── composables/        # useReports, useFileImport, useDreAnalysis...
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
