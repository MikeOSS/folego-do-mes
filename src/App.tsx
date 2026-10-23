import React, { useState } from 'react';
import { Activity, ShieldCheck } from 'lucide-react';
import { FinancialStoreProvider, useFinancialStore } from './state/useFinancialStore';
import { TopDemoRibbon } from './components/TopDemoRibbon';
import { PulseHeroCard } from './components/PulseHeroCard';
import { LiquidityStepChart } from './components/LiquidityStepChart';
import { CommitmentsLedger } from './components/CommitmentsLedger';
import { SimulatorSheet } from './components/SimulatorSheet';

const MainWorkspace: React.FC = () => {
  const { activeScenario, activeProjection } = useFinancialStore();
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#F4F6F8] text-[#091521]">
      {/* Barra Superior de Instrumentação dos 7 Cenários Demonstrativos */}
      <TopDemoRibbon />

      {/* Cabeçalho Institucional da Plataforma Fôlego do Mês */}
      <div className="bg-white border-b border-[#DCE3EA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[8px] bg-[#061826] border border-[#14354D] flex items-center justify-center shadow-xs">
              <Activity className="w-5 h-5 text-[#00E58F]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-extrabold tracking-tight text-[#091521]">
                  Fôlego do Mês
                </span>
                <span className="px-1.5 py-0.5 rounded-[4px] bg-[#E6F6F0] border border-[#00875A]/30 text-[#006644] font-mono-tabular text-[10px] font-bold uppercase">
                  Previsibilidade 30d
                </span>
              </div>
              <p className="text-xs text-[#475869]">
                Monitoramento determinístico de liquidez e cobertura de compromissos
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-[#475869] bg-[#F4F6F8] border border-[#DCE3EA] rounded-[6px] px-3 py-1.5">
            <ShieldCheck className="w-4 h-4 text-[#00875A]" />
            <span>
              Cliente demonstrativo: <strong className="text-[#091521]">{activeScenario.personaName}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Área Principal Responsiva:
          - Mobile (< 1024px): Fluxo Único Vertical Contínuo (Pulso -> Curva -> Ledger)
          - Desktop (>= 1024px): Split View Assimétrico Editorial (Pulso Fixo à Esquerda + Curva & Ledger à Direita) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Coluna Esquerda (Desktop Sticky 5 colunas): Pulso do Mês + Escopo */}
          <div className="lg:col-span-5 lg:sticky lg:top-16 space-y-4">
            <PulseHeroCard onOpenNewEntryModal={() => setIsCreatingNew(true)} />

            {/* Nota de Escopo e Transparência Metodológica */}
            <aside className="tactile-card rounded-[10px] p-4 space-y-2 text-xs text-[#475869]">
              <div className="font-bold text-[#091521] uppercase tracking-wider text-[11px]">
                Como o Fôlego do Mês calcula sua projeção
              </div>
              <p className="leading-relaxed">{activeProjection.scopeDisclaimer}</p>
              <ul className="space-y-1 text-[11px] list-disc list-inside text-[#475869]">
                <li>
                  <strong>Cheque especial isolado:</strong> limites de crédito nunca são
                  somados ao seu saldo disponível.
                </li>
                <li>
                  <strong>Proteção contra duplicidade:</strong> boletos do DDA equivalentes
                  a lembretes manuais são descontados apenas uma vez.
                </li>
                <li>
                  <strong>Simulação segura:</strong> testar datas ou marcar "pago por outro
                  banco" não cancela agendamentos reais.
                </li>
              </ul>
            </aside>
          </div>

          {/* Coluna Direita (Desktop 7 colunas): Curva de Fôlego em Degraus + Ledger Cronológico */}
          <div className="lg:col-span-7 space-y-5">
            <LiquidityStepChart />
            <CommitmentsLedger onOpenNewEntryModal={() => setIsCreatingNew(true)} />
          </div>
        </div>
      </main>

      {/* Rodapé Discreto de Protótipo Independente */}
      <footer className="mt-8 border-t border-[#DCE3EA] bg-white py-4 px-4 sm:px-6 text-center text-xs text-[#475869]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            <strong>Fôlego do Mês</strong> — Protótipo funcional independente com dados
            fictícios, desenvolvido para apresentação técnica.
          </p>
          <p className="text-[11px] text-[#7A8C9E]">
            Sem vínculo oficial com o Agibank • Motor financeiro determinístico testado com
            Vitest
          </p>
        </div>
      </footer>

      {/* Bottom Sheet / Modal de Simulação e Edição */}
      <SimulatorSheet
        isCreatingNew={isCreatingNew}
        onCloseCreateNew={() => setIsCreatingNew(false)}
      />
    </div>
  );
};

export function App() {
  return (
    <FinancialStoreProvider>
      <MainWorkspace />
    </FinancialStoreProvider>
  );
}

export default App;
