# Revisão Crítica Multidisciplinar por Subagentes — Fôlego do Mês

Este documento consolida os pareceres independentes executados por **4 subagentes especializados** sobre a proposta arquitetural e visual inicial (`docs/INITIAL_PROPOSAL.md`), detalhando as falhas identificadas, os conflitos resolvidos e as mudanças incorporadas à arquitetura final antes da implementação.

---

## 1. Visão Geral das 4 Auditorias Independentes

| Especialista (Subagente) | Foco da Auditoria | Principais Críticas à Proposta Inicial | Mudanças Incorporadas na Arquitetura Final |
| :--- | :--- | :--- | :--- |
| **1. Arquiteto de Software Sênior** (`Software Architect Reviewer`) | Modularidade, contratos TypeScript, imutabilidade, separação entre estado de simulação e motor puro. | 1. Mutar `FinancialEntry` com flags de `deduplicated` mistura input com estado derivado.<br>2. Histórico completo de undo/redo é overengineering; falta modelo de *patch/override* imutável.<br>3. Falta comparação paralela entre cenário original (*Baseline*) e cenário simulado (*Simulated*). | - Criação de `EvaluatedEntry` como envelope de saída do motor.<br>- Estado de simulação baseado em `entryOverrides: Record<string, EntryOverride>` + `balanceOverrideCents`.<br>- Dupla execução pura via `useMemo` (`baselineResult` vs `simulatedResult`) para cálculo instantâneo de delta de impacto. |
| **2. Engenheiro de QA e Regras Financeiras** (`QA Financial Engine Reviewer`) | Matemática bancária em centavos, ordenação intradiária, deduplicação determinística, atrasos e matriz Vitest. | 1. Contradição matemática entre as duas curvas e recebimentos `uncertain`.<br>2. Risco intradiário (boleto de manhã e salário à tarde no mesmo dia) não pode gerar falso déficit de fechamento nem passar despercebido.<br>3. Deduplicação ingênua causaria falsos positivos em dois Pix ou boletos legítimos da mesma fonte.<br>4. Contas `pending` com `effectiveDate < referenceDate` sumiriam da janela. | - **3 Curvas de Fechamento** (`confirmedEnd`, `projectedEnd`, `optimisticEnd`) + **Mínimo Intradiário** (`intradayMin`).<br>- Subtipos explícitos em `warningReasons` (`ESTIMATED_OUTFLOW_RISK`, `UNCERTAIN_INFLOW_DEPENDENCY`, `INTRADAY_TIMING_RISK`).<br>- Regra de **5 Critérios de Deduplicação** (exige origens cruzadas compatíveis ou `dedupeKey`).<br>- *Overdue Clamping*: itens vencidos e pendentes são alocados em `referenceDate` (`t_0`) com `isOverdue: true`. |
| **3. Staff Product & UI Designer** (`Staff Product Designer Reviewer`) | Identidade autoral inspirada no universo Agibank, tipografia, anti-clichê IA e geometria do gráfico. | 1. Fontes serifadas (`Instrument Serif`/`Newsreader`) parecem recorte de jornal e prejudicam leitura rápida mobile.<br>2. Gráfico em curva suave (*spline*) mente visualmente sobre o saldo bancário entre dias sem movimentação.<br>3. Excesso de badges redondos (`rounded-full`) e sombras difusas parecem template genérico de IA. | - Dupla tipográfica técnica: **`Plus Jakarta Sans`** (pesos 500–800, tracking negativo) + **`JetBrains Mono`** (`tabular-nums` estrito em todos os valores e datas).<br>- Geometria **Step-After (Gráfico de Degraus de Liquidez)** com hachura SVG diagonal abaixo de `R$ 0,00` e *Callout Pins* automáticos.<br>- Superfície *Deep Trust Anchor* (`#061826`) com acento *Luz de Fôlego* (`#00E58F`) e bordas estruturais (`1px solid #DCE3EA`). |
| **4. Especialista em UX Mobile & Acessibilidade** (`Mobile UX & A11y Reviewer`) | Ergonomia de polegar, fluxo cognitivo sem troca de abas, WCAG 2.2 AA/AAA e UX Writing financeiro. | 1. Dividir o mobile em 3 abas (`Horizonte`, `Compromissos`, `Simulador`) quebra o loop visual de causa e efeito.<br>2. Tocar em nós de 7px no gráfico em telas de 375px é inviável sem *Quick Milestone Pills* e *HUD Header*.<br>3. Misturar o seletor dos 7 cenários com a navegação do cliente confunde avaliador e usuário. | - **Single-Screen Reactive Canvas** no mobile: Pulso + Gráfico de Degraus + Ledger na mesma tela, com *Bottom Sheet* compacto e **Atalhos de 1 Toque** (*"Adiar para após o salário"*, *"Pago por outro banco"*).<br>- **Top Demo Ribbon** dedicada no topo para o avaliador alternar entre os 7 cenários.<br>- Dupla codificação visual (traço sólido vs. tracejado + hachuras) e `aria-live="polite"`. |

---

## 2. Resolução de Conflitos entre os Revisores

### Conflito 1: Tipografia Editorial Com Serifa vs. Tipografia Técnica Sem Serifa
- **Proposta Inicial:** Sugeria combinar uma fonte serifada (`Instrument Serif` / `Newsreader`) nos títulos de diagnóstico com `Plus Jakarta Sans` e `JetBrains Mono`.
- **Parecer do Product Designer & Especialista Mobile:** Ambos convergiram contra a serifada. O Product Designer apontou que serifas itálicas em aplicativos bancários brasileiros soam artificiais ("template de luxo genérico"), enquanto o Especialista em UX Mobile destacou perda de legibilidade em telas pequenas para usuários ansiosos ou com presbiopia.
- **Decisão Consolidada:** Adotamos **`Plus Jakarta Sans`** (com pesos fortes `600`/`700`/`800` e `letter-spacing: -0.03em`) para títulos e diagnósticos, destacando os valores e datas críticas inline com pills técnicos e **`JetBrains Mono`** (`tabular-nums`) para toda informação quantitativa.

### Conflito 2: Tratamento de Movimentações no Mesmo Dia (Ordem Intradiária)
- **Dilema:** Se o cliente tem R$ 100 de saldo, um boleto confirmado de R$ 500 e um salário confirmado de R$ 3.000 na mesma data (`10/11`), o motor deve acusar déficit ou saldo positivo?
- **Parecer do Arquiteto vs. QA Financeiro:** Ambos concordaram que acusar `PREVENTIVE_ALERT` (déficit confirmado) num dia que fecha em `+R$ 2.600,00` seria um falso positivo irritante, mas ignorar o risco de o débito bater às 08h antes de o salário cair às 14h seria negligente.
- **Decisão Consolidada:**
  - A curva principal de fechamento (`confirmedEndBalanceCents`) reflete o saldo consolidado do fim do dia (`+R$ 2.600,00`).
  - O motor calcula simultaneamente `intradayMinBalanceCents[d] = openingConfirmed - confirmedOutflows`.
  - Se `intradayMinBalanceCents < 0` e `confirmedEndBalanceCents >= 0`, o dia recebe `intradayTimingRisk: true` e o estado geral (caso não haja déficit mais grave) assume `CONDITIONAL_WARNING` com subtipo `'INTRADAY_TIMING_RISK'`, exibindo um aviso específico de janela horária bancária.

### Conflito 3: Navegação Mobile em Abas vs. Tela Única com Bottom Sheet Contextual
- **Proposta Inicial:** Previa barra de navegação inferior com 3 abas no mobile.
- **Parecer do Product Designer & Especialista em UX Mobile:** Unânimes em eliminar as 3 abas. O valor mágico do *Fôlego do Mês* está em editar um compromisso e assistir imediatamente à curva de degraus sair da zona hachurada negativa.
- **Decisão Consolidada:** Layout mobile em **Fluxo Único Vertical Sincronizado**, equipado com:
  1. **Top Demo Ribbon** no topo para alternância instantânea entre os **7 cenários demonstrativos**.
  2. **Mini-HUD Sticky** que acompanha a rolagem mostrando o status atual e o impacto da simulação em tempo real.
  3. **Bottom Sheet Contextual** com *Quick-Sim Pills* (ações de 1 toque sem exigir teclado virtual, além de edição fina de valor/data/status/certeza).

---

## 3. Veredito da Etapa de Revisão
Todas as 4 perspectivas foram atendidas sem introduzir camadas burocráticas ou dependências pesadas. A arquitetura resultante mantém um motor financeiro 100% puro e determinístico em `src/domain/`, coberto por uma matriz rigorosa de 18 testes unitários no Vitest, acoplado a uma interface reativa de altíssima precisão visual.
