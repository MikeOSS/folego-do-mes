# UI polish — registro de execução

## Alvo comprovado em 23/10/2026

| Campo | Valor |
| --- | --- |
| DEPLOY_URL | https://folego-do-mes.vercel.app/ |
| REPO | https://github.com/MikeOSS/folego-do-mes |
| REPO_SHA inicial | 9f5ab73383321a488fa1cc9ad5eb6072c51b40fd |
| BRANCH | main |
| DATA_AUDITORIA | 2026-10-23, America/Sao_Paulo |
| Vercel project | folego-do-mes / prj_UVBWtCNOq8nhnbYbLDMaEiMsDUDk |
| Vercel scope | mikeoss-projects / team_TFLIQbk0ZP6BMbwdcPTAV2YI |
| Deployment inicial | dpl_9BYqhvB6Ren1EGT57oDmt9fLcBGC — READY |
| Aliases iniciais | folego-do-mes.vercel.app, folego-do-mes-mikeoss-projects.vercel.app |

Evidência: `vercel inspect folego-do-mes.vercel.app` e API `GET /v9/projects/{projectId}` autenticados na CLI. `targets.production.meta.githubCommitSha` coincide com HEAD inicial. Não há vínculo demonstrado com `solerpedroo/case_agi`/`case-agi.vercel.app`; são produtos distintos. O conector MCP retornou 403; a CLI existente tinha acesso e foi usada sem alterar permissões.

O plano do usuário fica em `polish-ui.md` **somente local**, ignorado pelo Git por solicitação explícita. Este registro é o acompanhamento versionado das adaptações e evidências.

## Aplicabilidade de cada onda

| Onda / IDs | Execução neste produto |
| --- | --- |
| 0 / 00.1–00.5 | Paridade confirmada; inventário real, baseline Chromium/Lighthouse/axe, jornada e identidade Fôlego preservada. |
| 1 / 01.1–01.6 | Main já existe; adicionar skip link. Drawer equivalente é seletor de cenários e diálogo do simulador. Header responsivo, nomes, foco e touch. CardTitle e rotas Next são N/A; headings reais existentes serão revisados. |
| 2 / 02.1–02.6 | Não há sliders/renda/parcelas/score. Aplicar associação de labels, validação BRL/data, estado de persona/cenário e comparativo base/simulado. Gestor/Cliente e choque/torre são N/A. |
| 3 / 03.1–03.6 | Tokens existentes, legibilidade, escala, componentes compartilhados onde necessários, método linear e reflow. Não há diagrama ASCII. |
| 4 / 04.1–04.6 | Pulso, gráfico de liquidez, extrato e fonte/data. Dados incompletos explícitos, tabela equivalente ao SVG, sem inventar Radar/Torre/Business Case. |
| 5 / 05.1–05.7 | Consultor Gemini: contexto por cenário, status real, anúncio, pergunta preservada/retry, request em andamento e inspector. Não há chat histórico/typing/Groq/modos; preservar padrão de resposta única e scroll natural. |
| 6 / 06.1–06.6 | Timeline de compromissos e apresentação de sete cenários, overlays do simulador, reduced motion JS, deep link `?cenario=`. Régua D-90/Groq/FAB não existem e são N/A. |
| 7 / 07.1–07.7 | Playwright/axe/reflow/visual, CI, Lighthouse comparável, regressão financeira e documentação final; testes humanos de leitor/dispositivos físicos ficam explicitamente pendentes. |

## Jornada real

1. Escolher cenário/persona fictícia → visualizar diagnóstico de cobertura; seletor com seleção explícita e retorno ao gatilho.
2. Entender menor saldo, primeira insuficiência, origem e período → inspecionar gráfico/dados; informação insuficiente pede saldo, não inventa zero.
3. Abrir compromisso ou simular lançamento → preencher valor/data → aplicar → comparar base e resultado; cancelar/restaurar preserva cenário.
4. Consultar orientação → pergunta → carregamento → Gemini ou resposta local identificada; falha oferece nova tentativa sem perder pergunta.
5. Conferir regras/fontes/contexto e abrir slides; retorno mantém deep link do cenário quando não há reload.

Nenhuma onda altera `src/domain`, fixtures financeiras ou matemática da projeção. A regressão inicial tem 22 testes Vitest aprovados e build aprovado.

## Reprodução e artefatos

```sh
npm ci
npx playwright install chromium
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
# Outro terminal:
node scripts/ui-audit.mjs
node scripts/ui-performance.mjs
# Depois: AUDIT_PHASE=after (PowerShell: $env:AUDIT_PHASE='after')
```

`artifacts/ui/before/` e `after/` ficam locais/artefatos de CI, nunca no bundle de produção. Captura inicial: sete cenários × 1440×900, 1280×800, 768×1024, 390×844 e 320×640, mais slides. O relatório JSON inclui overflow, headings, axe, erros JS/console/HTTP. Testes E2E complementam estados abertos/loading/fallback/erro e reflow.

Lighthouse: Chromium Playwright, production preview local, uma execução mobile padrão e outra com preset desktop. Comparação de laboratório, sem alegar INP/p75 de usuários reais. Máquina e rede variam; não confundir score Lighthouse com aprovação WCAG.

## Revisões e entregas

- Onda 0: revisão independente `review_wave0`; adicionada coleta console/HTTP e preset Lighthouse desktop após achados. Cobertura de estado inicial não é declarada como matriz integral de aceite.
- Onda 1: skip link/main focável, seletor e simulador em dialog nativo com foco/Escape/inert/scroll lock/retorno; header em duas linhas mobile, controles >=44px, extrato com botão explícito em vez de interativos aninhados. Revisão `review_wave0`: corrigidos overflow do header e instrução antiga do extrato. Seis testes Playwright desktop/mobile passaram; capturas em `artifacts/ui/wave1`. Contraste e demais reflows tratados na Onda 3.
- Onda 2: labels estáveis em todos os campos financeiros, seleção programática de cenário/tipo, validação de BRL e comparativo negativo em texto. Revisão independente encontrou valor extremo capaz de estourar a soma; UI agora limita entradas a R$ 100 milhões em módulo (motor intacto). Erro é limpo ao cancelar. Corrigidos reflow do formulário do consultor e encolhimento do form do simulador após falha E2E mobile reproduzível. Seis E2E de formulário e 22 testes financeiros aprovados. Capturas `artifacts/ui/wave2`.
- Onda 3: tokens de texto/feedback/raio/sombra/motion/gráficos; metadados relevantes >=12px, H1 24–28px, extrato empilhado mobile, método linear em disclosure e marca centralizada. Revisão independente identificou centavos proporcionais de 9,24px: agora têm mínimo de 12px e sem opacidade. Reflow com controles internos passou em 14 casos; varredura dos 35 cenários/viewports eliminou todos os 14 overflows e interativos aninhados iniciais. Ajustes finais de contraste foram medidos com axe nas telas e diálogos. Capturas `artifacts/ui/wave3`. Nenhuma mudança no motor.
- Onda 4: fonte/data/unidade por módulo; gráfico com heading, resumo de risco, seletor por teclado e tabela com cabeçalhos; gráfico precede o consultor. Context Pack passa a usar saldo efetivo simulado e representar ausência como “Dado indisponível”. Revisão independente encontrou curva original de zeros técnicos quando base era insuficiente: removida do domínio/render e coberta por teste. Explicação contempla entradas estimadas. Quatro E2E de gráficos, 14 de reflow e 24 testes Vitest aprovados. Capturas `artifacts/ui/wave4`.
- Onda 5: política explícita de resposta única por consulta/cenário, pergunta preservada, lock síncrono, cancelamento e contexto conferido antes de aplicar tools; erro com retry, log sem leitura palavra a palavra e anúncio sucinto. Nenhum autoscroll foi adicionado. Status atual distingue aguardando/consultando/local/última resposta Gemini/sem conexão/erro. Timeout de 15s por tentativa remota e SDK carregado sob demanda; JS inicial caiu de ~904KB para ~491KB (não confundir com transferência gzip). Revisão independente reproduziu uma tool monetária extrema derrubando o render: o lote inteiro agora valida valores e datas antes da primeira mutação. Testes live mock/fallback/offline/cancelamento/retry/tool inválida em desktop/mobile; capturas `artifacts/ui/wave5`.
- Onda 6: guia demo no fluxo, recolhimento persistido, saída/retomada preservando query params; motion reduzido no JS e CSS; marcos do gráfico focam heading da data; histórico restaura cenário. Revisão independente reproduziu perda de simulações ao voltar só uma âncora e rascunho aberto após mudar cenário no histórico: ambos corrigidos com comparação de cenário e fechamento dos painéis. Dez E2E de demo/histórico/reduced motion e seis de shell passaram. Capturas `artifacts/ui/wave6`. Régua D-90/FAB do outro produto permanecem N/A.
- Onda 7: ESLint real e typecheck separados (app, API e testes), 31 testes Vitest com sete snapshots de métricas/séries/elegibilidade, suíte completa com 66 casos aprovados e dez exclusões intencionais (nove duplicações de baselines no segundo projeto e um timeout mobile compartilhado). Nove baselines visuais Windows/Chromium: quatro viewports e cinco estados mobile. Timeout remoto de 15s, inspector e erro recuperável também testados. Revisão independente pediu baselines dos estados e coleta de auditoria/Lighthouse no CI: incluídos. Um `pre` rolável não focável foi detectado no novo axe e corrigido. Fontes exatas do baseline passam a ser locais/preloaded com licenças após Lighthouse atribuir CLS 0,105 à troca tardia de web fonts. Capturas em `artifacts/ui/after`, `playwright-report` e nove PNGs versionados (~871KB ao todo).

## Resultado mensurado localmente

Resultados de laboratório no production preview, não indicadores p75 de usuários reais. Dados completos: [antes](before.json) e [depois](after.json).

| Medida | Antes | Depois |
| --- | --- | --- |
| Cenários × viewports auditados | 35 | 35 |
| Casos com overflow global | 14 | 0 |
| Regras axe com violações | 3 | 0 |
| Erros JavaScript nas capturas | 0 | 0 |
| Lighthouse acessibilidade mobile/desktop | 96 / 96 | 100 / 100 |
| Lighthouse performance mobile/desktop | 78 / 99 | 92 / 99 |
| LCP mobile | 3,19 s | 2,17 s |
| CLS mobile | 0 | 0,00035 |
| TBT mobile (não é INP) | 299 ms | 284 ms |
| JavaScript inicial / gzip | 900,68 / 222,66 KB | 494,63 / 152,40 KB |

Orçamento determinístico no CI: JS inicial <=550KB e gzip <=180KB. Lighthouse é coletado como evidência; suas notas variam com a máquina/rede. O CI gera um único relatório Playwright completo e anexa auditoria/Lighthouse por 14 dias. A fonte local elimina a dependência de rede do Google Fonts nos testes visuais. `src/domain` e `src/data` foram comparados ao SHA inicial e permanecem idênticos.

Entregas feitas por commits sequenciais em `main` e push por onda, conforme solicitado; não foram abertos PRs de merge para commits já publicados. Aceite visual humano e os requisitos exclusivamente do AgiPulse não são declarados concluídos.

## Publicação

Produção: **https://folego-do-mes.vercel.app/**. Commit da implementação: `759d8312955f7b44ef1c135f6ce032f313a1b556`; branch `main`; deployment `dpl_83yNg4ufyzEPwqhXKhiY7wAPCmFC`, **READY / PROMOTED**, build remoto de 29s. O registro posterior de documentação não altera os artefatos da aplicação.

O mesmo deployment passou primeiro por teste autenticado no navegador: sete cenários × desktop/mobile, menu, simulação, tabela, axe sem violações e consulta real ao endpoint. Após a promoção, **30 testes de navegador passaram na URL pública**. A API real retornou 503 por ausência de chave Gemini; a orientação local foi apresentada corretamente, sem simular resposta generativa ao vivo. O teste de IA saudável usa mock, explicitamente identificado nos testes.

[CI da implementação aprovado](https://github.com/MikeOSS/folego-do-mes/actions/runs/40033970525): 31 testes unitários, 66 verificações de navegador, nove baselines visuais, 36 capturas da auditoria, zero overflow/axe/erros JS. Lighthouse no runner: performance mobile 95, desktop 100; acessibilidade 100 em ambos. Esses números são do runner e não substituem a comparação local da tabela acima. Dados: [ci.json](ci.json) e [release.json](release.json).

Consulta de logs do deployment após publicação: zero registros runtime de nível `error` observados na janela de uma hora. Isso não certifica monitoramento contínuo; Web Vitals de usuários reais e dispositivos/leitores físicos continuam pendentes. Projeto e scope foram conferidos antes do deploy, e o alias foi consultado pela API para confirmar o SHA publicado.

`polish-ui.md` permanece somente local, nunca foi rastreado pelo Git e também está excluído do upload da CLI, junto a credenciais e artefatos, por `.vercelignore`.

| Onda | Commit enviado |
| --- | --- |
| 0 | `36c8468` |
| 1 | `4b82619` |
| 2 | `d7d7c7d` |
| 3 | `8aaf8ec` |
| 4 | `7fb4cde` |
| 5 | `7d9c142` |
| 6 | `98182ef` |
| 7 | `759d831` |

## Pendências de aceite humano

NVDA/VoiceOver, Safari/iOS e Android físicos, zoom nativo 200%, avaliação visual pelo responsável e p75 Web Vitals real não podem ser certificados por Chromium headless. Nenhum checkbox de aceite integral é marcado com base apenas em automação.
