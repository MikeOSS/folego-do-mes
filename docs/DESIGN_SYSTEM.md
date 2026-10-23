# Design System & Direção de Arte — Fôlego do Mês

## 1. Filosofia Visual: *Precision Brazilian Fintech*
O **Fôlego do Mês** foi desenhado sob uma premissa inegociável: **transmitir a autoridade técnica, a calma e a clareza de um produto financeiro construído por um time sênior de engenharia e design**, rejeitando todos os clichês de interfaces genéricas geradas por IA.

### O que foi deliberadamente banido:
- ❌ Gradientes roxos/azuis neon, brilhos artificiais e *glassmorphism* sem função.
- ❌ Grade monótona de cards brancos iguais com sombras borradas (`shadow-lg`) e cantos exageradamente redondos (`rounded-3xl`).
- ❌ Pílulas coloridas (`rounded-full`) empilhadas na mesma linha competindo pela atenção.
- ❌ Curvas suaves (*splines Bézier*) que mentem sobre o saldo bancário entre dias sem movimentação.

### O que define nossa assinatura autoral:
- ✅ **Deep Trust Anchor (`#061826`) + Luz de Fôlego (`#00E58F`):** Inspirado na energia solar/esmeralda e na estabilidade do azul profundo do universo Agibank, porém com calibração cromática autoral de terminal financeiro moderno.
- ✅ **Step-After Liquidity Horizon (Gráfico de Degraus de Caixa):** Representação geométrica fiel onde o saldo permanece em patamar horizontal até o dia exato do débito/crédito, com área de déficit preenchida por **hachura diagonal técnica em SVG (`45deg`)** abaixo da régua física de `R$ 0,00`.
- ✅ **Tipografia Quantitativa de Precisão:** `Plus Jakarta Sans` (tracking negativo `-0.03em`) para leitura rápida em 3 segundos + `JetBrains Mono` (`tabular-nums`) para valores em Reais, datas e contadores de dias.

---

## 2. Tokens de Cores (WCAG 2.2 AA / AAA)

### 2.1. Superfícies e Estrutura
| Token CSS | Hex | Aplicação |
| :--- | :--- | :--- |
| `--bg-canvas` | `#F4F6F8` | Fundo geral da página (Cinza-gelo mineral com 2% de matiz azul-petróleo). |
| `--bg-surface` | `#FFFFFF` | Superfície de cartões principais, gráfico de degraus e lista de compromissos. |
| `--bg-surface-subtle` | `#EEF2F5` | Cabeçalhos de grupos de data, itens ignorados/deduplicados e células secundárias. |
| `--bg-abyssal` | `#061826` | Painel de Pulso Principal (*Deep Trust Anchor*) e Barra de Simulação Ativa. |
| `--bg-abyssal-cell` | `#0C2538` | Células de KPIs dentro do Painel de Pulso escuro (borda `#163A54`). |
| `--border-hairline` | `#DCE3EA` | Borda estrutural de `1px solid` para definição tátil sem sombras pesadas. |

### 2.2. Acentos e Semântica de Estado Financeiro
| Estado / Contexto | Texto / Ícone | Linha / Destaque | Fundo / Superfície | Codificação Não-Cromática (Daltonismo) |
| :--- | :--- | :--- | :--- | :--- |
| **Fôlego Positivo (`NO_SHORTFALL`)** | `#006644` / `#00E58F` (no escuro) | `#00875A` | `#E6F6F0` | Linha contínua sólida + Ícone de Escudo/Check + Área limpa acima de R$ 0. |
| **Aviso Condicional (`CONDITIONAL_WARNING`)** | `#92400E` (Contraste `7.4:1`) | `#D97706` | `#FFFBEB` | Linha tracejada (`6 4`) + Hachura espaçada + Ícone de Relógio/Atenção. |
| **Alerta Preventivo (`PREVENTIVE_ALERT`)** | `#991B1B` (Contraste `8.2:1`) | `#DC2626` | `#FEF2F2` | Hachura diagonal densa (`45deg`) abaixo de R$ 0 + Ícone de Alerta Sólido. |
| **Dados Insuficientes (`INSUFFICIENT_DATA`)** | `#334155` (Contraste `9.3:1`) | `#64748B` | `#F1F5F9` | Estado diagnóstico dedicado sem gráfico especulativo. |
| **Modo Simulação (`SIMULATION_ACTIVE`)** | `#3730A3` / `#A5B4FC` | `#4F46E5` | `#EEF2FF` | Barra lateral esquerda `3px solid #4F46E5` + Valor original tachado (`old → new`). |

---

## 3. Tipografia e Hierarquia Escaneável (Regra dos 3 Segundos)

1. **`Plus Jakarta Sans` (500, 600, 700, 800):**
   - Manchete Executiva do Pulso: `clamp(1.05rem, 1.6vw, 1.25rem)`, `font-weight: 600`, `line-height: 1.35`.
   - Títulos de Compromissos: `15px` (`0.9375rem`), `font-weight: 600`.
   - Micro-labels técnicos (Eyebrows): `11px` (`0.6875rem`), `font-weight: 700`, `uppercase`, `letter-spacing: 0.08em`.
2. **`JetBrains Mono` (500, 600, 700) com `font-variant-numeric: tabular-nums`:**
   - Obrigatório em todos os valores monetários (`R$ 1.420,00`), deltas (`+R$ 340,00`), contadores de fôlego (`9 DIAS`) e datas (`14 NOV`).
   - Nos KPIs principais, o prefixo `R$` e os centavos `,00` têm `0.75em` e opacidade `0.75`, destacando imediatamente a grandeza inteira do valor.

---

## 4. Arquitetura Responsiva: Mobile-First Real vs. Desktop Editorial

### 4.1. Mobile (`< 1024px`) — *Single-Screen Reactive Canvas*
- **Sem abas que escondem o gráfico:** O usuário visualiza o **Pulso do Mês**, a **Curva de Fôlego em Degraus** e a **Linha do Tempo de Compromissos** em um único fluxo vertical contínuo.
- **Pills de Dias Críticos:** Logo abaixo do gráfico SVG, botões táteis (`min-height: 44px`) levam direto aos marcos importantes (*Hoje*, *1º Déficit*, *Menor Saldo*, *Próximo Salário*), eliminando a dificuldade de acertar pontos pequenos com o polegar.
- **Simulação de 1 Toque (*Zero-Typing Quick Pills*):** Ao tocar em qualquer compromisso, abre-se um *Bottom Sheet* ergonômico com ações imediatas:
  - `[✓ Já paguei por outro banco]`
  - `[🗓️ Adiar para após o salário]` (calcula automaticamente a data do próximo recebimento confirmado!)
  - `[⇄ Alternar Confirmado / Estimado]`
  - Além de edição rápida de valor e data com aviso transparente de que **simulações não alteram pagamentos reais**.

### 4.2. Desktop (`>= 1024px`) — *Split View Assimétrico*
- **Coluna Esquerda Sticky (`400px`):** Painel de Pulso em Azul Abissal (`#061826`), Diagnóstico Detalhado, Resumo de Cobertura (Entradas Confirmadas vs. Saídas Confirmadas vs. Estimadas) e Painel de Controle de Simulação Ativa.
- **Coluna Direita Fluida:** Curva de Fôlego Interativa em largura total no topo + Linha do Tempo Cronológica detalhada abaixo, com inspeção sincronizada entre os degraus do gráfico e os dias da lista.
