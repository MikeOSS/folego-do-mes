# Proposta Inicial de Arquitetura e Design — Fôlego do Mês

## 1. Visão do Produto e Propósito
O **Fôlego do Mês** é uma plataforma de inteligência financeira preditiva determinante (sem IA generativa ou caixas-pretas) focada em antecipar crises de liquidez no curto prazo (próximos 30 a 45 dias).
Em vez de mostrar gráficos de pizza do passado ("você gastou R$ 400 em restaurantes"), ele responde com precisão cirúrgica à pergunta mais urgente do brasileiro:
**"Meu saldo atual e meus próximos recebimentos cobrem as contas que vão vencer até o próximo salário, ou vou entrar no cheque especial em algum dia específico?"**

---

## 2. Arquitetura de Software (Enxuta, Modular e Testável)

Seguindo o princípio de **Zero Overengineering** para um MVP de altíssima qualidade, adotamos uma separação estrita em camadas funcionais dentro de `src/`:

```text
Projeto_Agi/
├── docs/
│   ├── ARCHITECTURE.md          # Arquitetura consolidada e decisões técnicas (ADRs)
│   ├── SUBAGENT_REVIEWS.md      # Pareceres críticos dos 4 especialistas e resolução de conflitos
│   └── DESIGN_SYSTEM.md         # Identidade visual, tipografia, cores, tokens e ergonomia
├── src/
│   ├── domain/                  # Camada Pura de Domínio Financeiro (Zero dependência de React/UI)
│   │   ├── types.ts             # Entidades em centavos (Cents), datas ISO (YYYY-MM-DD), Status, Alertas
│   │   ├── money.ts             # Operações seguras em centavos inteiros e formatação BRL
│   │   ├── engine.ts            # Motor determinístico de projeção diária de saldo e diagnóstico
│   │   └── __tests__/           # Suíte exaustiva de testes unitários com Vitest
│   │       └── engine.test.ts
│   ├── data/                    # Dados Demonstrativos e Fixtures
│   │   └── scenarios.ts         # 7 cenários realistas + metadados explicativos para apresentação
│   ├── state/                   # Gerenciamento de Estado e Simulação
│   │   └── useFinancialStore.ts # Hook/Context com estado base, overrides de simulação, histórico de edições e reset
│   ├── components/              # Interface do Usuário (Mobile-First + Desktop Editorial)
│   │   ├── layout/              # Header, seletor de cenários, barra mobile / split-view desktop, disclaimer
│   │   ├── pulse/               # Resumo executivo ("Fôlego atual", card de status/alerta inteligente, métricas)
│   │   ├── horizon/             # Elemento Visual Assinatura: Linha do Tempo & Curva de Liquidez Interativa
│   │   ├── ledger/              # Lista de compromissos e recebimentos, filtros, badges de origem e certeza
│   │   └── simulator/           # Bottom Sheet (mobile) / Drawer-Modal (desktop) para edição e simulação hipotética
│   ├── styles/
│   │   └── index.css            # Tokens CSS, Tailwind v4/v3, fontes Google (Plus Jakarta Sans, Instrument Serif/Newsreader, JetBrains Mono)
│   ├── App.tsx
│   └── main.tsx
├── vercel.json                  # Configuração de rewrite SPA e headers de cache/segurança
└── package.json
```

---

## 3. Regras do Motor Financeiro Determinístico (`src/domain/`)

### 3.1. Representação Monetária e Datas
- **Valores Monetários (`Cents`):** Inteiros representando centavos (`number` validado com `Number.isSafeInteger`). Ex: R$ 1.250,50 = `125050`. Nenhuma soma ou subtração usa float.
- **Datas (`ISODateString`):** Strings estritas `YYYY-MM-DD` sem conversão implícita para `new Date()` com fuso horário local (evitando o clássico bug de `UTC-3` voltar 1 dia às 21h). Comparação lexicográfica direta (`"2026-11-05" < "2026-11-10"`) e utilitários puros para cálculo de diferença de dias.

### 3.2. Entidades Principais
- `AccountSnapshot`:
  - `availableBalanceCents`: Saldo em conta corrente livre (exclui explicitamente limite de cheque especial, que pode ser informado apenas como `overdraftLimitCents` para mostrar quanto de juros/limite está sendo evitado, mas nunca somado ao saldo disponível).
  - `referenceDate`: Data base da análise (`YYYY-MM-DD`).
  - `hasCompleteData`: Flag indicando se a conta possui dados mínimos confiáveis.
- `FinancialEntry` (Movimentação):
  - `id`: string
  - `title`: string
  - `amountCents`: inteiro positivo
  - `dueDate`: `YYYY-MM-DD` (data original de vencimento/previsão)
  - `effectiveDate`: `YYYY-MM-DD` (data efetiva considerada na projeção — permite simular postergação sem perder a `dueDate` original para alertar sobre atraso!)
  - `type`: `'inflow'` (recebimento) | `'outflow'` (compromisso/despesa)
  - `certainty`: `'confirmed'` (confirmado/agendado/salário fixo) | `'estimated'` (estimado/variável) | `'uncertain'` (recebimento incerto/atrasado)
  - `status`: `'pending'` | `'paid_here'` (já descontado do saldo atual) | `'paid_other_bank'` (pago por outra instituição) | `'cancelled'`
  - `origin`: `'dda'` | `'pix_agendado'` | `'debito_automatico'` | `'recorrente_historico'` | `'manual'` | `'folha_pagamento'`
  - `affectsMonitoredAccount`: boolean (se `false`, ex: cartão pago por outro banco, não afeta o saldo)
  - `fingerprint` opcional ou lógica de deduplicação: detecta lançamentos duplicados (mesmo valor, mesmo título normalizado/beneficiário e mesma janela de data, ex: DDA + lançamento manual duplicado).

### 3.3. Regras de Ordenação, Deduplicação e Projeção
1. **Filtragem de Elegibilidade:**
   - Ignorar `status === 'cancelled'`, `status === 'paid_here'` (pois já afetou o `availableBalanceCents`), `status === 'paid_other_bank'` ou `affectsMonitoredAccount === false`.
   - Deduplicação automática: quando dois compromissos ativos parecem duplicados (ex: mesmo valor e código/título equivalente na mesma data, como um boleto no DDA e um lembrete manual), o motor marca o segundo como `deduplicated` (não soma duas vezes, mas exibe na interface com transparência).
2. **Duas Curvas Simultâneas de Saldo Diário:**
   - **Curva Confirmada (`confirmedBalanceCents`):** Parte do `availableBalanceCents` + entradas `confirmed` - saídas `confirmed`. (Ignora entradas `uncertain` e saídas `estimated`).
   - **Curva Projetada Total (`projectedBalanceCents`):** Parte do `availableBalanceCents` + entradas `confirmed` - saídas (`confirmed` + `estimated`).
   - **Ordenação Intradiária (Movimentações no mesmo dia):** Dentro de uma mesma data `YYYY-MM-DD`, como saber se há risco?
     - Para o saldo de fechamento do dia, somam-se as entradas e subtraem-se as saídas elegíveis do dia.
     - Porém, também registramos o risco intradiário (caso uma saída de débito automático ocorra antes de um recebimento no mesmo dia, ou ordenamos de forma conservadora: saídas confirmadas antes de entradas se o horário não for garantido, ou calculamos saldo final do dia + flag de atenção intradiária). *Ponto para revisão dos subagentes!*
3. **Métricas de Diagnóstico:**
   - `firstShortfallDate`: Primeira data em que o saldo projetado fica `< 0`.
   - `firstConfirmedShortfallDate`: Primeira data em que o saldo apenas com itens confirmados fica `< 0`.
   - `maxDeficitCents`: O menor valor negativo atingido no período (maior buraco de caixa).
   - `lowestBalanceCents` e `lowestBalanceDate`: O ponto de menor fôlego do mês (mesmo que positivo, ex: "Seu menor saldo será R$ 42,00 no dia 14").
   - `daysUntilShortfall`: Quantos dias faltam até a primeira insuficiência.
4. **Classificação dos 4 Estados de Alerta Inteligente:**
   - `INSUFFICIENT_DATA` (**Informações insuficientes**): Quando `hasCompleteData === false`, saldo inválido/ausente ou ausência total de visibilidade mínima confiável.
   - `PREVENTIVE_ALERT` (**Alerta preventivo**): Quando `firstConfirmedShortfallDate !== null` (compromissos confirmados sozinhos já levam o saldo abaixo de zero).
   - `CONDITIONAL_WARNING` (**Aviso condicional**): Quando `firstConfirmedShortfallDate === null`, mas `firstShortfallDate !== null` (compromissos confirmados cabem no saldo, mas as despesas estimadas provocam déficit, ou a cobertura depende de um recebimento marcado como `uncertain`).
   - `NO_SHORTFALL_IDENTIFIED` (**Sem insuficiência identificada**): Quando `firstShortfallDate === null` (todos os compromissos conhecidos confirmados e estimados estão cobertos no horizonte, com aviso claro de que se refere apenas aos compromissos mapeados).

---

## 4. Direção de Design e Experiência ("Editorial Precision Banking")

### 4.1. Filosofia Estética Anti-Clichê IA
- **Conceito:** *Editorial Precision Banking* — inspirado na clareza tátil de relatórios financeiros suíços combinado com o calor humano e as cores institucionais do universo Agibank (Azul Profundo & Verde/Turquesa Luminoso), sem copiar o app oficial.
- **Paleta de Cores:**
  - Superfície Principal: Off-white mineral quente (`#F7F8F5`) com cartões em branco puro (`#FFFFFF`) e bordas sutis de 1px (`#E2E7E4`).
  - Superfície de Destaque ("Deep Trust Anchor"): Azul Abissal Profundo (`#071A2C` a `#0B2540`) usado com parcimônia cirúrgica no Painel de Pulso Principal e na barra de simulação ativa.
  - Acento Positivo / Interativo ("Fôlego"): Turquesa/Verde Esmeralda Vivo (`#00B87C` / `#00A86B` em fundos claros; `#19E6A0` em fundo azul profundo).
  - Semântica de Risco:
    - Alerta Preventivo (Déficit Confirmado): Terracota/Coral Escuro (`#C93B2B`, fundo `#FDF2F0`) — sério, legível, sem ser neon histérico.
    - Aviso Condicional (Risco por Estimativa): Âmbar Queimado (`#B45309`, fundo `#FEF7EC`).
- **Tipografia:**
  - Títulos e Diagnóstico Editorial: **Instrument Serif** ou **Newsreader** (itálicos sutis em palavras-chave do diagnóstico trazem sofisticação editorial imediata que nenhuma interface genérica de IA tem) combinada com **Plus Jakarta Sans** para UI estrutural.
  - Valores Financeiros e Datas: **JetBrains Mono** (ou `tabular-nums` rigoroso) garantindo alinhamento vertical perfeito de centavos e datas.

### 4.2. Elemento Visual Assinatura: "Curva de Fôlego (Liquidity Horizon)"
- Um gráfico interativo sob medida em SVG + Motion (`Curva de Fôlego`), onde:
  - A **Linha d'Água (R$ 0,00)** é desenhada claramente como um divisor físico.
  - A **Curva Confirmada** é uma linha sólida precisa; a **Curva com Estimados** é uma linha tracejada/sombreada logo abaixo.
  - Quando a curva cruza abaixo de R$ 0,00, a área de déficit ganha uma hachura diagonal técnica (padrão arquitetônico SVG `<pattern>`) em terracota ou âmbar, destacando visualmente o "Vale de Insuficiência" e o dia exato do ponto crítico.
  - Ao tocar/passar o mouse em qualquer nó da linha do tempo, o usuário inspeciona o saldo daquele dia e os eventos que causaram a queda ou subida.

### 4.3. Arquitetura Mobile-First vs. Desktop
- **Mobile (< 1024px):**
  - Topo compacto com Seletor Rápido de Cenários (em um drawer/pill discreto de demonstração) + Card de Pulso do Mês (Saldo livre, Fôlego em dias, Diagnóstico claro).
  - Abas ou navegação inferior ergonômica para o polegar: `Visão & Horizonte`, `Compromissos (Ledger)`, `Simulador / Cenários`.
  - Edição de qualquer compromisso abre um **Bottom Sheet** fluido com botões de toque amplos (mínimo 44px): "Já paguei por outro banco", "Ajustar valor/data", "Alternar Confirmado/Estimado".
- **Desktop (>= 1024px):**
  - Layout Assimétrico Editorial de 2 Colunas:
    - Coluna Esquerda (Fixa/Sticky, 420px): Painel de Pulso em Azul Profundo, Diagnóstico Inteligente, Resumo de Cobertura e Controles de Simulação Ativa.
    - Coluna Direita (Fluida): Curva de Fôlego Interativa em largura total no topo + Linha do Tempo Cronológica detalhada abaixo, permitindo editar compromissos inline ou em painel lateral e ver a curva SVG se redesenhar em tempo real.
