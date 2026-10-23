import { FunctionDeclaration, GoogleGenAI, Type } from '@google/genai';

const GEMINI_SIMULATOR_TOOLS: FunctionDeclaration[] = [
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

const SYSTEM_INSTRUCTION = `Você é o Consultor Financeiro de IA do "Fôlego do Mês" (solução desenhada por Miguel Fernandes Costacurta para o Agibank).
REGRAS OBRIGATÓRIAS:
1. Você NUNCA inventa números nem calcula saldos no chute: use estritamente os dados do CONTEXT PACK JSON fornecido pelo motor determinístico.
2. Nunca considere cheque especial como saldo disponível.
3. Diferencie sempre compromissos CONFIRMADOS de despesas ESTIMADAS e recebimentos INCERTOS.
4. Se o usuário pedir para simular uma ação, chame a tool correspondente!
5. Se simular adiar uma conta confirmada para depois do vencimento, alerte sempre que atrasar boletos pode gerar multas e juros, e que a simulação não altera agendamentos bancários reais.
6. Responda em português claro, acolhedor, direto e sem jargões técnicos.`;

export default async function handler(
  req: { method?: string; body?: { userPrompt?: string; contextPack?: unknown } },
  res: {
    status: (code: number) => {
      json: (payload: unknown) => void;
    };
  }
) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      error: 'GEMINI_API_KEY not configured on server',
    });
    return;
  }

  try {
    const { userPrompt = '', contextPack = {} } = req.body ?? {};
    const ai = new GoogleGenAI({ apiKey });

    const fullPrompt = `CONTEXT PACK JSON (FONTE DA VERDADE DO MOTOR DETERMINÍSTICO):
${JSON.stringify(contextPack, null, 2)}

PEDIDO DO CLIENTE:
"${userPrompt}"

Instruções:
- Se o pedido envolver simular pagamento por outro banco, mudar data, alterar valor, adicionar item ou limpar simulação, CHAME a tool correspondente usando os IDs exatos de "entries".
- Além disso, explique em até 3 frases curtas o diagnóstico atual com base nos números exatos do Context Pack e liste 2 a 3 próximos passos práticos.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: GEMINI_SIMULATOR_TOOLS }],
        temperature: 0.2,
      },
    });

    res.status(200).json({
      model: 'gemini-2.5-flash',
      text: response.text ?? '',
      functionCalls: response.functionCalls ?? [],
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Erro interno ao consultar Gemini API',
    });
  }
}
