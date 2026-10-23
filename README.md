# Fôlego do Mês — Inteligência Preditiva de Liquidez e Cobertura Financeira

Validação e histórico do polish de UI: [registro de execução](docs/ui-baseline/README.md).

```sh
npm run check         # typecheck app/API/testes, ESLint, Vitest e build
npm run check:bundle  # orçamento do JavaScript inicial
npx playwright install chromium
npm run test:e2e      # jornadas, teclado, cenários, IA mockada e axe
npm run test:visual   # compara os baselines revisados; não os atualiza
```

O CI executa a suíte completa em Windows/Chromium, preserva relatórios e coleta auditoria de reflow/axe e Lighthouse. Os baselines visuais são de Windows para manter a mesma renderização de fontes; novas referências devem ser revisadas antes de usar `npm run test:visual:update`. Leitores de tela e dispositivos físicos continuam sujeitos a validação humana.

> **Processo Seletivo — Formação de Devs Nativos em IA do Agibank**  
> Aplicação web responsiva (Mobile-First & Desktop Editorial) com motor financeiro determinístico em centavos inteiros, 7 cenários demonstrativos interativos e simulador de fôlego de caixa em tempo real.

---

## 1. O Problema e a Proposta de Valor

Milhões de brasileiros entram no cheque especial ou sofrem estornos de débito automático não por falta de renda mensal total, mas por **descasamento de fluxo de caixa nos próximos 10 a 20 dias**: uma sequência de contas fixas vence no dia 14, enquanto o salário só cai no dia 20.

O **Fôlego do Mês** antecipa esse risco em **menos de 3 segundos**, respondendo com precisão matemática (sem "caixas-pretas" ou alucinações generativas):
1. **Meu saldo livre atual (sem contar cheque especial) e meus próximos recebimentos cobrem os compromissos até o fim do mês?**
2. **Qual é a primeira data exata de possível insuficiência e qual o maior déficit projetado?**
3. **O risco vem de contas confirmadas, de despesas variáveis estimadas, de um recebimento incerto ou de conflito de horário no mesmo dia?**
4. **O que acontece com meu fôlego se eu já tiver pago um boleto por outro banco ou simular outra data/valor?**

---

## 2. Destaques de Engenharia, Produto e Design

### Motor Financeiro Determinístico Puro (`src/domain/`)
- **Zero Erros de Ponto Flutuante:** Toda a aritmética monetária opera sobre inteiros seguros em centavos (`Cents`, validado por `Number.isSafeInteger`).
- **Imunidade a Fuso Horário (`UTC-3`):** Datas civis são tratadas como strings `YYYY-MM-DD` com operações calendáricas ancoradas ao meio-dia UTC (`12:00:00Z`), eliminando o clássico bug de recuo de 1 dia no horário de Brasília.
- **Isolamento do Cheque Especial:** O limite de cheque especial nunca é somado ao saldo disponível.
- **Deduplicação Inteligente em 5 Critérios:** Evita descontar duas vezes um mesmo compromisso (ex: boleto capturado via DDA + lembrete cadastrado manualmente pelo cliente), mas preserva lançamentos legítimos de mesmo valor (ex: dois Pix agendados de R$ 50 no mesmo dia).
- **Três Curvas Diárias + Risco Intradiário:**
  - *Curva Confirmada (Firme)*: Saldo livre + entradas confirmadas - saídas confirmadas.
  - *Curva Projetada*: Inclui despesas variáveis estimadas.
  - *Curva Otimista*: Inclui recebimentos marcados como incertos/pendentes, permitindo diagnosticar quando a cobertura depende exclusivamente de um repasse incerto.
  - *Mínimo Intradiário*: Detecta dias que fecham no azul, mas nos quais débitos matinais superam o saldo antes da queda do salário no mesmo dia (`INTRADAY_TIMING_RISK`).

### Direção de Arte Autoral (*Precision Brazilian Fintech*)
- **Painel de Pulso (*Deep Trust Anchor* `#061826` + *Luz de Fôlego* `#00E58F`):** Inspirado na energia e confiança cromática do universo Agibank, com identidade visual própria e contraste WCAG AA/AAA.
- **Elemento Visual Assinatura — Curva de Fôlego em Degraus (`LiquidityStepChart.tsx`):** Em vez de curvas suaves (*splines*) que distorcem o saldo entre dias sem movimentação, implementamos um **Step-After Chart (Gráfico de Patamares de Caixa)** com:
  - Régua física de nível zero (`R$ 0,00`);
  - Preenchimento em **hachura diagonal arquitetônica SVG (`45deg`)** na zona de déficit;
  - **Callout Pins diretos** nos vértices críticos (sem exigir *hover* no celular);
  - Linha fantasma comparativa (*Baseline vs. Simulado*) quando o usuário edita qualquer compromisso.
- **Tipografia Quantitativa:** `Plus Jakarta Sans` para hierarquia e diagnóstico + `JetBrains Mono` (`tabular-nums`) para alinhamento vertical perfeito de todos os valores em Reais e datas.

---

## 3. Os 7 Cenários Demonstrativos Integrados

No topo da aplicação, a **Barra de Instrumentação do Avaliador (`TopDemoRibbon`)** permite alternar instantaneamente (inclusive pelo celular com 1 toque) entre os **7 cenários exigidos**:

| # | Cenário | Estado Esperado | Caso de Uso Demonstrado |
| :- | :--- | :--- | :--- |
| **1** | **Todos os compromissos cobertos** | `NO_SHORTFALL_IDENTIFIED` | Saldo positivo nos 30 dias + deduplicação automática de boleto DDA vs. lembrete manual. |
| **2** | **Insuficiência antes do recebimento** | `PREVENTIVE_ALERT` | Salário cai dia 20/nov, mas contas confirmadas geram déficit de `-R$ 340,00` no dia 14/nov. |
| **3** | **Risco apenas por despesas estimadas** | `CONDITIONAL_WARNING` | Contas confirmadas cabem no saldo (`+R$ 290`), mas gastos variáveis estimados levam a `-R$ 260`. |
| **4** | **Recebimento atrasado ou incerto** | `CONDITIONAL_WARNING` | Cobertura do aluguel em 12/nov depende da confirmação de uma Nota Fiscal incerta em 09/nov. |
| **5** | **Conta paga por outra instituição** | `PREVENTIVE_ALERT` → `NO_SHORTFALL` | Permite marcar em 1 toque que o financiamento no DDA já foi pago por outro banco. |
| **6** | **Movimentações no mesmo dia** | `CONDITIONAL_WARNING` | Salário e débitos automáticos no dia 10/nov: fechamento positivo, mas alerta de janela horária matinal. |
| **7** | **Informações insuficientes** | `INSUFFICIENT_DATA` | Conta sem saldo sincronizado bloqueia falsos alertas positivos até o usuário informar o saldo. |

---

## 4. Documentação Arquitetural e Revisões

Toda a modelagem e as revisões críticas dos 4 subagentes especialistas estão documentadas na pasta [`docs/`](./docs):
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — Arquitetura em camadas, especificação matemática do motor e Architecture Decision Records (ADRs).
- [`docs/SUBAGENT_REVIEWS.md`](./docs/SUBAGENT_REVIEWS.md) — Relatório consolidado das 4 auditorias independentes (Arquiteto de Software, Engenheiro de QA Financeiro, Product Designer Sênior e Especialista em UX Mobile & Acessibilidade) e resolução de conflitos.
- [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) — Tokens de cores, tipografia, geometria do gráfico de degraus e guia de UX Writing não-alarmista.

---

## 5. Como Executar Localmente e Publicar na Vercel

### Pré-requisitos
- Node.js `>= 18` e `npm`

### Instalação e Execução
```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor de desenvolvimento (Vite HMR)
npm run dev

# 3. Executar suíte de testes automatizados (22 testes no Vitest)
npm test

# 4. Verificar tipagem estrita TypeScript (Lint)
npm run lint

# 5. Gerar build otimizado de produção
npm run build
```

### Deploy na Vercel
O projeto já inclui o arquivo [`vercel.json`](./vercel.json) configurado com build estático (`dist`) e *rewrite* para SPA:
```bash
npx vercel --prod
```
Ou basta conectar o repositório GitHub (`https://github.com/MikeOSS/folego-do-mes.git`) diretamente no painel da Vercel — zero variáveis de ambiente ou serviços externos são necessários.

---

> *Nota: Este projeto é um protótipo funcional independente com dados financeiros fictícios, desenvolvido exclusivamente para avaliação técnica, sem vínculo oficial com o Agibank.*
