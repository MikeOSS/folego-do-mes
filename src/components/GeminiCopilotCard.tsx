import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Check,
  Code2,
  KeyRound,
  Loader2,
  Send,
  Terminal,
  Zap,
} from 'lucide-react';
import { useFinancialStore } from '../state/useFinancialStore';
import {
  askGeminiFinancialAdvisor,
  buildFinancialContextPack,
  GeminiAdvisorResponse,
  getStoredGeminiApiKey,
  setStoredGeminiApiKey,
} from '../services/geminiAdvisor';

export const GeminiCopilotCard: React.FC = () => {
  const {
    activeScenario,
    activeProjection,
    simulationDelta,
    updateEntryOverride,
    addSimulatedEntry,
    resetAllSimulations,
  } = useFinancialStore();

  const [promptInput, setPromptInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [advisorResponse, setAdvisorResponse] =
    useState<GeminiAdvisorResponse | null>(null);
  const [showContextPack, setShowContextPack] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState(() => getStoredGeminiApiKey());
  const [hasCustomKey, setHasCustomKey] = useState(
    () => getStoredGeminiApiKey().length > 10
  );

  const contextPack = useMemo(
    () =>
      buildFinancialContextPack(
        activeScenario,
        activeProjection,
        simulationDelta
      ),
    [activeScenario, activeProjection, simulationDelta]
  );

  // Ao trocar de cenário, limpa a resposta anterior para incentivar nova análise ou gera resumo contextual
  useEffect(() => {
    setAdvisorResponse(null);
  }, [activeScenario.id]);

  const handleRunPrompt = async (textToRun: string) => {
    const trimmed = textToRun.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    try {
      const response = await askGeminiFinancialAdvisor(trimmed, contextPack, {
        updateEntryOverride: (entryId, patch) =>
          updateEntryOverride(entryId, patch),
        addSimulatedEntry: (entry) => addSimulatedEntry(entry),
        resetAllSimulations: () => resetAllSimulations(),
      });
      setAdvisorResponse(response);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;
    const text = promptInput;
    setPromptInput('');
    void handleRunPrompt(text);
  };

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredGeminiApiKey(apiKeyDraft);
    setHasCustomKey(apiKeyDraft.trim().length > 10);
    setShowKeyModal(false);
  };

  const quickPrompts = [
    {
      label: 'Diagnosticar fôlego e plano de ação',
      prompt:
        'Analise meu fôlego do mês com base no Context Pack e me dê um plano de ação prático para os próximos dias.',
    },
    {
      label: 'Simular: já paguei a maior conta em outro banco',
      prompt:
        'E se eu já tiver pago minha maior conta pendente por outro banco? Simule isso para mim.',
    },
    {
      label: 'Simular: adiar conta para o dia do salário',
      prompt:
        'Adie minha principal conta pendente para o dia do meu próximo salário e me avise os riscos.',
    },
    {
      label: 'Simular: reduzir gasto estimado em 50%',
      prompt:
        'Reduza meu gasto estimado pela metade na simulação e me diga como fica meu menor saldo.',
    },
  ];

  return (
    <section
      aria-label="Consultor Financeiro Gemini com Function Calling"
      className="surface-raised p-5 sm:p-6 space-y-4 border-t-2 border-t-[#0064fd]"
    >
      {/* Cabeçalho do Consultor Gemini */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#0064fd]/10 border border-[#0064fd]/20 text-[#0064fd] flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold tracking-[-0.02em] text-[#151a28]">
                Copiloto Gemini · Simulação Inteligente
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0064fd]/10 text-[#0064fd] text-[10px] font-mono-tabular font-semibold">
                Gemini quando disponível · modo local alternativo
              </span>
            </div>
            <p className="text-xs text-[#525b6e]">
              Arquitetura híbrida: o motor calcula os centavos exatos e o Gemini explica ou executa simulações por comando natural.
            </p>
          </div>
        </div>

        {/* Botões de Governança: Context Pack JSON & API Key */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowContextPack((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
              showContextPack
                ? 'bg-[#151a28] text-white border-[#151a28]'
                : 'bg-[#f8f9fc] text-[#525b6e] border-[#151a28]/10 hover:text-[#151a28]'
            }`}
            title="Inspecionar o pacote JSON fechado enviado ao Gemini para impedir alucinações"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Context Pack</span>
          </button>

          <button
            type="button"
            onClick={() => setShowKeyModal((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
              hasCustomKey
                ? 'bg-[#2fc750]/12 text-[#168030] border-[#2fc750]/30'
                : 'bg-[#f8f9fc] text-[#525b6e] border-[#151a28]/10 hover:text-[#151a28]'
            }`}
            title="Configurar chave da API do Google Gemini (@google/genai)"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{hasCustomKey ? 'API Key Ativa' : 'Chave Gemini'}</span>
          </button>
        </div>
      </div>

      {/* Configurador Rápido de API Key do Google AI Studio */}
      {showKeyModal && (
        <form
          onSubmit={handleSaveApiKey}
          className="p-3.5 rounded-xl bg-[#f8f9fc] border border-[#0064fd]/20 space-y-2.5 text-xs"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#151a28]">
              Conectar Chave Google Gemini API (<code className="font-mono-tabular">@google/genai</code>)
            </span>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0064fd] font-medium hover:underline"
            >
              Gerar chave gratuita no AI Studio →
            </a>
          </div>
          <p className="text-[#525b6e] leading-relaxed">
            Se a variável <code className="font-mono-tabular">GEMINI_API_KEY</code> estiver configurada na Vercel ou se você colar sua chave aqui (salva apenas na aba atual), as chamadas usam <code className="font-mono-tabular">gemini-2.5-flash</code> ao vivo. Sem chave, o modo híbrido local garante funcionamento 100% contínuo na apresentação.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={apiKeyDraft}
              onChange={(e) => setApiKeyDraft(e.target.value)}
              placeholder="Cole sua AIzaSy... (Google Gemini API Key)"
              className="flex-1 px-3 py-2 rounded-lg border border-[#151a28]/15 bg-white text-[#151a28] font-mono-tabular text-xs focus:outline-none focus:border-[#0064fd]"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-lg bg-[#0064fd] hover:bg-[#0052d0] text-white font-semibold text-xs cursor-pointer"
            >
              Salvar chave
            </button>
          </div>
        </form>
      )}

      {/* Inspetor de Context Pack JSON (Transparência Técnica para a Banca) */}
      {showContextPack && (
        <div className="p-3.5 rounded-xl bg-[#151a28] text-slate-200 space-y-2 text-xs overflow-hidden">
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-white/10 pb-2">
            <span className="font-mono-tabular font-semibold text-[#2fc750]">
              CONTEXT PACK FECHADO · ENVIADO AO GEMINI-2.5-FLASH
            </span>
            <span>Cálculo financeiro pelo motor</span>
          </div>
          <pre className="font-mono-tabular text-[11px] leading-relaxed overflow-x-auto max-h-52 text-slate-300">
            {JSON.stringify(contextPack, null, 2)}
          </pre>
        </div>
      )}

      {/* Pílulas de Comando Rápido (1 Toque) */}
      <div className="flex flex-wrap gap-1.5">
        {quickPrompts.map((item) => (
          <button
            key={item.label}
            type="button"
            disabled={isLoading}
            onClick={() => void handleRunPrompt(item.prompt)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f1f4f9] hover:bg-[#0064fd]/10 text-[#525b6e] hover:text-[#0064fd] text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            <Zap className="w-3 h-3 text-[#0064fd]" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Campo de Linguagem Natural */}
      <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row sm:items-center gap-2">
        <input
          type="text"
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          disabled={isLoading}
          placeholder='Peça uma análise ou simule (ex: "Já paguei o aluguel em outro banco" ou "Adie para o dia do salário")...'
          className="flex-1 min-w-0 w-full px-4 py-2.5 rounded-full border border-[#151a28]/12 bg-[#f8f9fc] focus:bg-white text-xs sm:text-sm text-[#151a28] placeholder:text-[#8891a5] focus:outline-none focus:border-[#0064fd] transition-colors"
        />
        <button
          type="submit"
          disabled={isLoading || !promptInput.trim()}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-[#0064fd] hover:bg-[#0052d0] disabled:opacity-50 text-white text-xs font-semibold transition-all cursor-pointer shrink-0 min-h-[40px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Analisando...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Analisar ou simular</span>
            </>
          )}
        </button>
      </form>

      {/* Resposta Estruturada + Function Calls Executadas */}
      {advisorResponse && (
        <div className="p-4 rounded-xl bg-[#f8f9fc] border border-[#151a28]/8 space-y-3 animate-fadeIn">
          {/* Badges das Function Calls acionadas pelo Gemini */}
          {advisorResponse.executedTools.length > 0 && (
            <div className="space-y-1.5">
              {advisorResponse.executedTools.map((tool, i) => (
                <div
                  key={`${tool.toolName}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#2fc750]/12 border border-[#2fc750]/25 text-xs text-[#168030]"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Terminal className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      <strong>{advisorResponse.mode === 'hybrid-local-engine' ? 'Simulação local executada:' : 'Função solicitada pela IA:'}</strong> {tool.summary}
                    </span>
                  </div>
                  <span className="font-mono-tabular text-[10px] px-2 py-0.5 rounded bg-white/80 text-[#151a28]">
                    {tool.toolName}()
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Diagnóstico Principal */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#0064fd] font-semibold">
                Diagnóstico Baseado no Context Pack
              </span>
              <span className="text-[10px] font-mono-tabular text-[#8891a5]">
                {advisorResponse.modelUsed}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#151a28] leading-relaxed font-medium">
              {advisorResponse.diagnosis}
            </p>
          </div>

          {/* Plano de Ação Sugerido */}
          {advisorResponse.actionPlan.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-[#151a28]/6">
              <span className="text-[11px] font-semibold text-[#525b6e] block">
                Recomendações e próximos passos:
              </span>
              <ul className="space-y-1.5">
                {advisorResponse.actionPlan.map((step, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-[#525b6e] leading-relaxed"
                  >
                    <Check className="w-3.5 h-3.5 text-[#168030] shrink-0 mt-0.5" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Nota de Governança */}
          <div className="pt-2 border-t border-[#151a28]/6 text-[11px] text-[#8891a5] flex items-center justify-between gap-2">
            <span>{advisorResponse.riskDisclaimer}</span>
          </div>
        </div>
      )}
    </section>
  );
};
