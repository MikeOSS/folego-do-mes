import { FunctionDeclaration, GoogleGenAI, Type } from '@google/genai';
import {
  CertaintyLevel,
  EntryType,
  ISODateString,
  ProjectionResult,
} from '../domain/types';
import { DemoScenario } from '../data/scenarios';
import { SimulationDelta } from '../state/useFinancialStore';
import { formatBRL } from '../domain/money';
import { formatShortDatePT } from '../domain/date';

const STORAGE_KEY_GEMINI_API = 'folego_do_mes_gemini_api_key_v1';

export function getStoredGeminiApiKey(): string {
  try {
    const envKey = (import.meta as unknown as { env?: Record<string, string> }).env
      ?.VITE_GEMINI_API_KEY;
    if (envKey && envKey.trim().length > 10) {
      return envKey.trim();
    }
    return sessionStorage.getItem(STORAGE_KEY_GEMINI_API) ?? '';
  } catch {
    return '';
  }
}

export function setStoredGeminiApiKey(key: string): void {
  try {
    if (!key.trim()) {
      sessionStorage.removeItem(STORAGE_KEY_GEMINI_API);
    } else {
      sessionStorage.setItem(STORAGE_KEY_GEMINI_API, key.trim());
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Context Pack Fechado:
 * Empacota apenas os números já validados pelo motor determinístico em centavos inteiros.
 * O Gemini nunca faz conta de cabeça sem referência: ele lê este pacote auditável.
 */
export interface FinancialContextPack {
  schemaVersion: '1.0';
  modelGuardrail: 'DETERMINISTIC_ENGINE_SOURCE_OF_TRUTH';
  scenarioId: string;
  scenarioName: string;
  personaName: string;
  referenceDate: ISODateString;
  availableBalanceBRL: string;
  overdraftExcludedBRL: string;
  alertStatus: ProjectionResult['alertStatus'];
  headline: string;
  lowestConfirmedBalanceBRL: string;
  lowestProjectedBalanceBRL: string;
  firstShortfallDate: ISODateString | null;
  daysUntilShortfall: number | null;
  mainCauseEntryTitle: string | null;
  nextConfirmedInflow: {
    title: string;
    date: ISODateString;
    amountBRL: string;
  } | null;
  simulationActive: {
    hasChanges: boolean;
    minProjectedDeltaBRL: string;
  };
  entries: Array<{
    id: string;
    title: string;
    type: EntryType;
    amountBRL: string;
    dueDate: ISODateString;
    effectiveDate: ISODateString;
    certainty: CertaintyLevel;
    status: string;
    eligibility: string;
  }>;
}

export function buildFinancialContextPack(
  scenario: DemoScenario,
  projection: ProjectionResult,
  delta: SimulationDelta
): FinancialContextPack {
  const nextInflow = projection.evaluatedEntries.find(
    (ev) =>
      ev.eligibility === 'included' &&
      ev.entry.type === 'inflow' &&
      ev.entry.certainty === 'confirmed'
  );

  const shortfallDayEntries = projection.metrics.firstShortfallDate
    ? projection.evaluatedEntries.filter(
        (ev) =>
          ev.eligibility === 'included' &&
          ev.entry.type === 'outflow' &&
          ev.projectedDate === projection.metrics.firstShortfallDate
      )
    : [];
  const mainCause = [...shortfallDayEntries].sort(
    (a, b) => b.entry.amountCents - a.entry.amountCents
  )[0];

  return {
    schemaVersion: '1.0',
    modelGuardrail: 'DETERMINISTIC_ENGINE_SOURCE_OF_TRUTH',
    scenarioId: scenario.id,
    scenarioName: scenario.title,
    personaName: scenario.personaName,
    referenceDate: scenario.snapshot.referenceDate,
    availableBalanceBRL: formatBRL(scenario.snapshot.availableBalanceCents ?? 0),
    overdraftExcludedBRL: formatBRL(scenario.snapshot.overdraftLimitCents),
    alertStatus: projection.alertStatus,
    headline: projection.headline,
    lowestConfirmedBalanceBRL: formatBRL(projection.metrics.lowestConfirmedBalanceCents),
    lowestProjectedBalanceBRL: formatBRL(projection.metrics.lowestProjectedBalanceCents),
    firstShortfallDate: projection.metrics.firstShortfallDate,
    daysUntilShortfall: projection.metrics.daysUntilShortfall,
    mainCauseEntryTitle: mainCause?.entry.title ?? null,
    nextConfirmedInflow: nextInflow
      ? {
          title: nextInflow.entry.title,
          date: nextInflow.projectedDate,
          amountBRL: formatBRL(nextInflow.entry.amountCents),
        }
      : null,
    simulationActive: {
      hasChanges: delta.hasChanges,
      minProjectedDeltaBRL: formatBRL(delta.lowestBalanceGainCents, {
        showPlusSign: true,
      }),
    },
    entries: projection.evaluatedEntries.map((ev) => ({
      id: ev.entry.id,
      title: ev.entry.title,
      type: ev.entry.type,
      amountBRL: formatBRL(ev.entry.amountCents),
      dueDate: ev.entry.dueDate,
      effectiveDate: ev.entry.effectiveDate,
      certainty: ev.entry.certainty,
      status: ev.entry.status,
      eligibility: ev.eligibility,
    })),
  };
}

/**
 * Declarações de Ferramentas (Function Calling) do Gemini para atuar sobre o Simulador
 */
export const GEMINI_SIMULATOR_TOOLS: FunctionDeclaration[] = [
  {
    name: 'mark_entry_paid_other_bank',
    description:
      'Simula que uma conta ou boleto já foi pago por outro banco, removendo seu desconto da conta monitorada.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        entryId: {
          type: Type.STRING,
          description: 'ID exato do compromisso no Context Pack (ex: c1-aluguel).',
        },
        reason: {
          type: Type.STRING,
          description: 'Breve explicação da ação simulada.',
        },
      },
      required: ['entryId', 'reason'],
    },
  },
  {
    name: 'postpone_entry_date',
    description:
      'Simula alterar a data de pagamento (effectiveDate) de um compromisso para uma nova data ISO YYYY-MM-DD (por exemplo, para o dia do próximo salário).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        entryId: {
          type: Type.STRING,
          description: 'ID exato do compromisso no Context Pack.',
        },
        newDateISO: {
          type: Type.STRING,
          description: 'Nova data simulada no formato YYYY-MM-DD.',
        },
        reason: {
          type: Type.STRING,
          description: 'Explicação do adiamento simulado.',
        },
      },
      required: ['entryId', 'newDateISO', 'reason'],
    },
  },
  {
    name: 'update_entry_amount',
    description:
      'Simula alterar o valor em Reais (R$) de um compromisso ou despesa estimada.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        entryId: {
          type: Type.STRING,
          description: 'ID exato do compromisso no Context Pack.',
        },
        newAmountBRL: {
          type: Type.NUMBER,
          description: 'Novo valor em reais (ex: 260 para R$ 260,00).',
        },
        reason: {
          type: Type.STRING,
          description: 'Motivo da redução ou ajuste de valor na simulação.',
        },
      },
      required: ['entryId', 'newAmountBRL', 'reason'],
    },
  },
  {
    name: 'add_simulated_entry',
    description:
      'Adiciona uma nova despesa ou entrada hipotética na simulação para testar o impacto no fôlego do mês.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: 'Nome do lançamento (ex: Farmácia, Freela, Conserto).',
        },
        amountBRL: {
          type: Type.NUMBER,
          description: 'Valor em reais (ex: 180).',
        },
        dateISO: {
          type: Type.STRING,
          description: 'Data no formato YYYY-MM-DD.',
        },
        type: {
          type: Type.STRING,
          description: 'outflow para despesa/saída ou inflow para entrada/recebimento.',
        },
      },
      required: ['title', 'amountBRL', 'dateISO', 'type'],
    },
  },
  {
    name: 'reset_all_simulations',
    description:
      'Desfaz todas as simulações e restaura os lançamentos originais do cenário.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: {
          type: Type.STRING,
          description: 'Motivo da restauração.',
        },
      },
      required: ['reason'],
    },
  },
];

export interface ExecutedToolAction {
  toolName: string;
  summary: string;
  args: Record<string, unknown>;
}

export interface GeminiAdvisorResponse {
  mode: 'gemini-live-api' | 'gemini-serverless' | 'hybrid-local-engine';
  modelUsed: string;
  diagnosis: string;
  actionPlan: string[];
  riskDisclaimer: string;
  executedTools: ExecutedToolAction[];
}

export interface StoreMutatorsForGemini {
  updateEntryOverride: (
    entryId: string,
    patch: {
      status?: 'pending' | 'paid_other_bank';
      effectiveDate?: ISODateString;
      amountCents?: number;
    }
  ) => void;
  addSimulatedEntry: (entry: {
    title: string;
    category: string;
    amountCents: number;
    dueDate: ISODateString;
    effectiveDate: ISODateString;
    type: EntryType;
    certainty: CertaintyLevel;
    status: 'pending';
    origin: 'manual';
    affectsMonitoredAccount: true;
  }) => void;
  resetAllSimulations: () => void;
}

const SYSTEM_INSTRUCTION = `Você é o Consultor Financeiro de IA do "Fôlego do Mês" (solução desenhada por Miguel Fernandes Costacurta para o Agibank).
REGRAS OBRIGATÓRIAS DE GOVERNANÇA E DILIGÊNCIA:
1. Você NUNCA inventa números nem calcula saldos no chute: use estritamente os dados do CONTEXT PACK JSON fornecido, que veio do motor determinístico em centavos inteiros.
2. Nunca considere cheque especial como saldo disponível.
3. Diferencie sempre compromissos CONFIRMADOS (boletos DDA, débito automático) de despesas ESTIMADAS e recebimentos INCERTOS.
4. Se o usuário pedir para simular uma ação (ex: marcar como pago por outro banco, adiar uma conta para o dia do salário, reduzir gasto estimado, criar novo gasto ou restaurar), chame a função/tool correspondente!
5. Se simular adiar uma conta confirmada para depois do vencimento, alerte sempre que atrasar boletos pode gerar multas e juros, e que a simulação não altera agendamentos bancários reais.
6. Responda em português claro, acolhedor, direto e sem jargões técnicos.`;

function executeToolCallsOnStore(
  functionCalls: Array<{ name?: string; args?: Record<string, unknown> }>,
  contextPack: FinancialContextPack,
  mutators: StoreMutatorsForGemini
): ExecutedToolAction[] {
  const executed: ExecutedToolAction[] = [];

  for (const fc of functionCalls) {
    const name = fc.name ?? '';
    const args = (fc.args ?? {}) as Record<string, unknown>;

    if (name === 'mark_entry_paid_other_bank') {
      const entryId = String(args.entryId ?? '');
      const target = contextPack.entries.find((e) => e.id === entryId);
      if (target) {
        mutators.updateEntryOverride(entryId, { status: 'paid_other_bank' });
        executed.push({
          toolName: name,
          summary: `"${target.title}" (${target.amountBRL}) marcado como pago em outro banco`,
          args,
        });
      }
    } else if (name === 'postpone_entry_date') {
      const entryId = String(args.entryId ?? '');
      const newDateISO = String(args.newDateISO ?? '') as ISODateString;
      const target = contextPack.entries.find((e) => e.id === entryId);
      if (target && /^\d{4}-\d{2}-\d{2}$/.test(newDateISO)) {
        mutators.updateEntryOverride(entryId, { effectiveDate: newDateISO });
        executed.push({
          toolName: name,
          summary: `Data de "${target.title}" simulada para ${formatShortDatePT(newDateISO)}`,
          args,
        });
      }
    } else if (name === 'update_entry_amount') {
      const entryId = String(args.entryId ?? '');
      const newAmountBRL = Number(args.newAmountBRL ?? 0);
      const target = contextPack.entries.find((e) => e.id === entryId);
      if (target && Number.isFinite(newAmountBRL) && newAmountBRL > 0) {
        const cents = Math.round(newAmountBRL * 100);
        mutators.updateEntryOverride(entryId, { amountCents: cents });
        executed.push({
          toolName: name,
          summary: `Valor de "${target.title}" ajustado na simulação para ${formatBRL(cents)}`,
          args,
        });
      }
    } else if (name === 'add_simulated_entry') {
      const title = String(args.title ?? 'Compromisso Simulado');
      const amountBRL = Number(args.amountBRL ?? 150);
      const dateISO = String(
        args.dateISO ?? contextPack.referenceDate
      ) as ISODateString;
      const type: EntryType =
        String(args.type ?? 'outflow') === 'inflow' ? 'inflow' : 'outflow';
      const cents = Math.max(100, Math.round(amountBRL * 100));

      mutators.addSimulatedEntry({
        title,
        category: type === 'inflow' ? 'Entrada Simulada via IA' : 'Gasto Simulado via IA',
        amountCents: cents,
        dueDate: dateISO,
        effectiveDate: dateISO,
        type,
        certainty: 'estimated',
        status: 'pending',
        origin: 'manual',
        affectsMonitoredAccount: true,
      });

      executed.push({
        toolName: name,
        summary: `Adicionado "${title}" (${formatBRL(cents)}) em ${formatShortDatePT(dateISO)}`,
        args,
      });
    } else if (name === 'reset_all_simulations') {
      mutators.resetAllSimulations();
      executed.push({
        toolName: name,
        summary: 'Todas as simulações foram restauradas ao estado original',
        args,
      });
    }
  }

  return executed;
}

/**
 * Executa a chamada ao Gemini:
 * 1. Se houver API Key no cliente (VITE_GEMINI_API_KEY ou colada pelo usuário), usa @google/genai direto do navegador.
 * 2. Senão, tenta a rota Serverless `/api/gemini` na Vercel (caso GEMINI_API_KEY esteja configurada nas variáveis do projeto).
 * 3. Se nenhuma chave externa estiver configurada ainda, executa o interpretador determinístico local, sem chamar a API Gemini para que a demonstração nunca falhe ao vivo.
 */
export async function askGeminiFinancialAdvisor(
  userPrompt: string,
  contextPack: FinancialContextPack,
  mutators: StoreMutatorsForGemini
): Promise<GeminiAdvisorResponse> {
  const clientKey = getStoredGeminiApiKey();

  const fullPrompt = `CONTEXT PACK JSON (FONTE DA VERDADE DO MOTOR DETERMINÍSTICO):
${JSON.stringify(contextPack, null, 2)}

PEDIDO DO CLIENTE:
"${userPrompt}"

Instruções:
- Se o pedido envolver simular pagamento por outro banco, mudar data, alterar valor, adicionar item ou limpar simulação, CHAME a tool correspondente usando os IDs exatos de "entries".
- Além disso, explique em até 3 frases curtas o diagnóstico atual com base nos números exatos do Context Pack e liste 2 a 3 próximos passos práticos.`;

  // 1) Chamada direta com @google/genai se o usuário tiver configurado a chave
  if (clientKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: clientKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: GEMINI_SIMULATOR_TOOLS }],
          temperature: 0.2,
        },
      });

      const calls = (response.functionCalls ?? []).map((fc) => ({
        name: fc.name,
        args: (fc.args ?? {}) as Record<string, unknown>,
      }));

      const executedTools = executeToolCallsOnStore(calls, contextPack, mutators);
      const rawText =
        response.text?.trim() ||
        (executedTools.length > 0
          ? `Pronto! Executei a simulação (${executedTools.map((t) => t.summary).join('; ')}) e o motor determinístico já recalculou a sua Curva de Fôlego.`
          : 'Análise concluída com base nos seus compromissos identificados.');

      return formatTextIntoAdvisorResponse(
        rawText,
        executedTools,
        'gemini-live-api',
        'gemini-2.5-flash'
      );
    } catch (err) {
      console.warn('Falha na chamada direta Gemini API, tentando fallback:', err);
    }
  }

  // 2) Tenta a rota Serverless /api/gemini (caso GEMINI_API_KEY esteja configurada na Vercel)
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userPrompt,
        contextPack,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        text?: string;
        functionCalls?: Array<{ name?: string; args?: Record<string, unknown> }>;
        model?: string;
      };
      const executedTools = executeToolCallsOnStore(
        data.functionCalls ?? [],
        contextPack,
        mutators
      );
      const rawText =
        data.text?.trim() ||
        (executedTools.length > 0
          ? `Simulação aplicada via Gemini (${executedTools.map((t) => t.summary).join('; ')}). Confira o novo saldo projetado no gráfico.`
          : '');
      if (rawText) {
        return formatTextIntoAdvisorResponse(
          rawText,
          executedTools,
          'gemini-serverless',
          data.model ?? 'gemini-2.5-flash'
        );
      }
    }
  } catch {
    // Continua para o motor híbrido local caso offline ou sem env var na Vercel
  }

  // 3) Interpretador de Intenção + Consultor Contextual Determinístico (Sem risco de falha na demo)
  return runLocalHybridAdvisorWithTools(userPrompt, contextPack, mutators);
}

function formatTextIntoAdvisorResponse(
  rawText: string,
  executedTools: ExecutedToolAction[],
  mode: GeminiAdvisorResponse['mode'],
  modelUsed: string
): GeminiAdvisorResponse {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const bulletLines = lines
    .filter((l) => /^[-•*1-9]/.test(l))
    .map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim());

  const paragraphLines = lines.filter((l) => !/^[-•*1-9]/.test(l));

  const diagnosis =
    paragraphLines.slice(0, 2).join(' ') ||
    lines[0] ||
    'Projeção analisada com base no motor determinístico.';

  const actionPlan =
    bulletLines.length > 0
      ? bulletLines.slice(0, 3)
      : paragraphLines.slice(2, 5).length > 0
        ? paragraphLines.slice(2, 5)
        : [
            'Toque em qualquer compromisso na lista abaixo para testar cenários sem afetar seus agendamentos reais.',
            'Priorize manter cobertura para contas confirmadas (boletos DDA e débito automático) antes do próximo salário.',
          ];

  return {
    mode,
    modelUsed,
    diagnosis,
    actionPlan,
    riskDisclaimer:
      'Os valores monetários vêm exclusivamente do Context Pack determinístico (sem cheque especial). Simulações não alteram pagamentos bancários reais.',
    executedTools,
  };
}

function runLocalHybridAdvisorWithTools(
  userPrompt: string,
  contextPack: FinancialContextPack,
  mutators: StoreMutatorsForGemini
): GeminiAdvisorResponse {
  const q = userPrompt.toLowerCase();
  const activeOutflows = contextPack.entries.filter(
    (e) => e.type === 'outflow' && e.eligibility === 'included'
  );
  const largestOutflow = [...activeOutflows].sort((a, b) => {
    const numA = Number(a.amountBRL.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
    const numB = Number(b.amountBRL.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
    return numB - numA;
  })[0];

  const matchingEntry =
    activeOutflows.find((e) => {
      const words = e.title
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 4);
      return words.some((w) => q.includes(w));
    }) ?? largestOutflow;

  const toolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

  if (q.includes('restaurar') || q.includes('limpar') || q.includes('reset')) {
    toolCalls.push({
      name: 'reset_all_simulations',
      args: { reason: 'Solicitado pelo usuário em linguagem natural' },
    });
  } else if (
    (q.includes('outro banco') || q.includes('já paguei') || q.includes('ja paguei')) &&
    matchingEntry
  ) {
    toolCalls.push({
      name: 'mark_entry_paid_other_bank',
      args: {
        entryId: matchingEntry.id,
        reason: `Simular que "${matchingEntry.title}" foi pago por outra instituição`,
      },
    });
  } else if (
    (q.includes('adia') ||
      q.includes('posterg') ||
      q.includes('salário') ||
      q.includes('salario') ||
      q.includes('mudar data')) &&
    matchingEntry &&
    contextPack.nextConfirmedInflow
  ) {
    toolCalls.push({
      name: 'postpone_entry_date',
      args: {
        entryId: matchingEntry.id,
        newDateISO: contextPack.nextConfirmedInflow.date,
        reason: `Simular pagamento de "${matchingEntry.title}" no dia do recebimento (${formatShortDatePT(contextPack.nextConfirmedInflow.date)})`,
      },
    });
  } else if (
    (q.includes('metade') || q.includes('50%') || q.includes('reduz')) &&
    matchingEntry
  ) {
    const estimatedTarget =
      activeOutflows.find((e) => e.certainty === 'estimated') ?? matchingEntry;
    const rawVal =
      Number(
        estimatedTarget.amountBRL.replace(/[^\d,]/g, '').replace(',', '.')
      ) || 200;
    toolCalls.push({
      name: 'update_entry_amount',
      args: {
        entryId: estimatedTarget.id,
        newAmountBRL: Math.round(rawVal * 0.5),
        reason: `Reduzir "${estimatedTarget.title}" em 50% na simulação`,
      },
    });
  } else if (q.includes('adicion') || q.includes('novo gasto') || q.includes('extra')) {
    const numberMatch = userPrompt.match(/(\d+(?:[.,]\d{1,2})?)/);
    const amountBRL = numberMatch
      ? Number(numberMatch[1].replace(',', '.'))
      : 180;
    toolCalls.push({
      name: 'add_simulated_entry',
      args: {
        title: 'Gasto Extra Simulado',
        amountBRL,
        dateISO: contextPack.firstShortfallDate ?? contextPack.referenceDate,
        type: 'outflow',
      },
    });
  }

  const executedTools = executeToolCallsOnStore(toolCalls, contextPack, mutators);

  if (executedTools.length > 0) {
    return {
      mode: 'hybrid-local-engine',
      modelUsed: 'Motor local (sem Gemini)',
      diagnosis: `Ação executada sobre o motor determinístico: ${executedTools.map((t) => t.summary).join('. ')}. O gráfico em degraus e o menor saldo projetado já foram recalculados em tempo real.`,
      actionPlan: [
        'Compare o card de impacto da simulação no topo para ver quantos reais de fôlego foram recuperados.',
        'Lembre-se: se você postergar um boleto confirmado para depois do vencimento original, podem incidir multas e juros.',
        'Você pode clicar em "Restaurar original" a qualquer momento para voltar ao cenário base.',
      ],
      riskDisclaimer:
        'Simulação executada por regras locais com dados do Context Pack. Nenhum modelo Gemini foi chamado e nenhum agendamento bancário real foi alterado.',
      executedTools,
    };
  }

  // Diagnóstico explicável baseado no estado atual do Context Pack
  if (contextPack.alertStatus === 'PREVENTIVE_ALERT') {
    return {
      mode: 'hybrid-local-engine',
      modelUsed: 'Motor local (sem Gemini)',
      diagnosis: `Identificamos um Alerta Preventivo: seu saldo disponível hoje é ${contextPack.availableBalanceBRL} (sem contar os ${contextPack.overdraftExcludedBRL} de cheque especial), mas suas contas confirmadas levam o saldo a ${contextPack.lowestConfirmedBalanceBRL} em ${contextPack.firstShortfallDate ? formatShortDatePT(contextPack.firstShortfallDate) : 'breve'}, puxado principalmente por "${contextPack.mainCauseEntryTitle ?? 'compromissos fixos'}".`,
      actionPlan: [
        `Caso você já tenha quitado "${contextPack.mainCauseEntryTitle ?? 'essa conta'}" por outro banco, clique em "Simular que paguei a maior conta por outro banco" para corrigir sua projeção.`,
        contextPack.nextConfirmedInflow
          ? `Seu próximo recebimento confirmado (${contextPack.nextConfirmedInflow.title} de ${contextPack.nextConfirmedInflow.amountBRL}) entra em ${formatShortDatePT(contextPack.nextConfirmedInflow.date)}. Teste simular o vencimento para essa data verificando possíveis encargos.`
          : 'Avalie antecipar uma transferência de outra instituição antes da data da primeira falta.',
        'Evite usar o limite do cheque especial sem perceber: o alerta foi disparado com antecedência justamente para você ter tempo de agir.',
      ],
      riskDisclaimer:
        'Análise gerada estritamente sobre o Context Pack determinístico. Nenhuma conta foi inventada ou arredondada.',
      executedTools: [],
    };
  }

  if (contextPack.alertStatus === 'CONDITIONAL_WARNING') {
    return {
      mode: 'hybrid-local-engine',
      modelUsed: 'Motor local (sem Gemini)',
      diagnosis: `Você está em Aviso Condicional: suas contas 100% confirmadas cabem no saldo (menor saldo confirmado: ${contextPack.lowestConfirmedBalanceBRL}), porém os gastos estimados ou o horário do débito podem levar o saldo projetado a ${contextPack.lowestProjectedBalanceBRL}.`,
      actionPlan: [
        'Como o risco vem de despesas variáveis/estimadas, reduzir parte do consumo variável nos próximos dias já mantém sua conta no azul.',
        'Use o botão "Reduzir gastos estimados pela metade" acima para ver na hora quanto fôlego você ganha.',
        'Se houver débito automático no mesmo dia do salário, confira se o crédito cai na conta antes do processamento da cobrança.',
      ],
      riskDisclaimer:
        'Análise gerada estritamente sobre o Context Pack determinístico (separando contas confirmadas de estimativas).',
      executedTools: [],
    };
  }

  if (contextPack.alertStatus === 'INSUFFICIENT_DATA') {
    return {
      mode: 'hybrid-local-engine',
      modelUsed: 'Motor local (sem Gemini)',
      diagnosis: `Ainda não há dados suficientes sincronizados para concluir sua projeção com segurança. Por responsabilidade, o Fôlego do Mês nunca emite um alerta falso nem garante cobertura quando faltam informações.`,
      actionPlan: [
        'Adicione seus principais compromissos manualmente no botão "Simular novo gasto" para testar como seu saldo de ' +
          contextPack.availableBalanceBRL +
          ' se comporta.',
      ],
      riskDisclaimer:
        'Proteção contra falsos negativos ativa: sem histórico mínimo, o motor declara Sem Conclusão.',
      executedTools: [],
    };
  }

  return {
    mode: 'hybrid-local-engine',
    modelUsed: 'Motor local (sem Gemini)',
    diagnosis: `Com base nos compromissos identificados até o momento, não encontramos falta de saldo no período. Seu menor saldo projetado é de ${contextPack.lowestProjectedBalanceBRL}, mantendo margem positiva sem tocar no cheque especial.`,
    actionPlan: [
      'Atenção: "sem insuficiência identificada" considera apenas as contas registradas e estimadas até agora — novos gastos no Pix ou cartão podem mudar esse cenário.',
      'Quer testar uma compra ou imprevisto antes de gastar? Digite por exemplo: "Adicione um gasto extra de R$ 400" para simular o impacto.',
    ],
    riskDisclaimer:
      'Análise gerada sobre o Context Pack determinístico. Não representa garantia contra gastos futuros não cadastrados.',
    executedTools: [],
  };
}
