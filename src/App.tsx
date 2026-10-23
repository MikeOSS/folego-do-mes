import React, { useState } from 'react';
import { ArrowUpRight, Presentation, ShieldCheck } from 'lucide-react';
import { FinancialStoreProvider, useFinancialStore } from './state/useFinancialStore';
import { TopDemoRibbon } from './components/TopDemoRibbon';
import { PulseHeroCard } from './components/PulseHeroCard';
import { LiquidityStepChart } from './components/LiquidityStepChart';
import { GeminiCopilotCard } from './components/GeminiCopilotCard';
import { CommitmentsLedger } from './components/CommitmentsLedger';
import { SimulatorSheet } from './components/SimulatorSheet';
import { Disclosure } from './components/ui/Disclosure';
import { PRODUCT } from './lib/product';

const MainWorkspace: React.FC = () => {
  const { activeProjection } = useFinancialStore();
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  return (
    <div className="min-h-[100dvh] flex flex-col text-[#151a28]">
      <a className="skip-link" href="#conteudo-principal">Pular para o conteúdo</a>
      {/* Header Unificado com Logo, Seletor dos 7 Cenários e Acesso aos Slides */}
      <TopDemoRibbon />

      {/* Layout Assimétrico Editorial (Mobile: coluna única / Desktop: 5 cols fixas + 7 cols de análise) */}
      <main id="conteudo-principal" tabIndex={-1} className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Coluna Esquerda (Sticky no Desktop): Pulso do Mês + Transparência & Case */}
          <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
            <PulseHeroCard onOpenNewEntryModal={() => setIsCreatingNew(true)} />

            {/* Card de Transparência do Motor Determinístico & Acesso aos Slides do Case */}
            <aside className="surface-raised p-5 space-y-4 text-xs text-muted">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#168030] shrink-0" />
                  <h2 className="text-base font-semibold text-[#151a28]">
                    Regras de proteção deste cálculo
                  </h2>
                </div>
                <span className="text-xs font-mono-tabular px-2 py-0.5 rounded-full bg-[#f1f4f9] text-muted">
                  100% Determinístico
                </span>
              </div>

              <p className="leading-relaxed text-muted">
                {activeProjection.scopeDisclaimer}
              </p>
              <Disclosure title="Como a previsão é calculada">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Partimos do saldo livre, sem somar o cheque especial.</li>
                  <li>Organizamos entradas e contas por data, retirando duplicidades identificadas.</li>
                  <li>Comparamos o saldo diário com as despesas confirmadas, estimadas e os recebimentos incertos.</li>
                  <li>Ao simular, mantemos a base para comparação. Nenhum pagamento real é realizado.</li>
                </ol>
              </Disclosure>

              <div className="grid grid-cols-1 gap-2 pt-1 border-t border-[#151a28]/6 text-xs">
                <div className="flex items-baseline gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0064fd] shrink-0 translate-y-[-1px]" />
                  <span>
                    <strong className="text-[#151a28]">Sem cheque especial:</strong> limite
                    de crédito nunca é somado ao seu saldo real.
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2fc750] shrink-0 translate-y-[-1px]" />
                  <span>
                    <strong className="text-[#151a28]">Sem duplicidade:</strong> boletos DDA
                    equivalentes a lembretes manuais contam uma única vez.
                  </span>
                </div>
              </div>

              <a
                href="/slides/index.html"
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#0064fd]/[0.05] hover:bg-[#0064fd]/[0.1] border border-[#0064fd]/15 transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#0064fd] text-white flex items-center justify-center shrink-0">
                    <Presentation className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-[#151a28] block truncate">
                      Apresentação do Case · Fôlego do Mês
                    </span>
                    <span className="text-xs text-muted block truncate">
                      Ver 15 slides interativos (Arquitetura, Produto e IA)
                    </span>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-brand shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            </aside>
          </div>

          {/* Coluna Direita: Copiloto Gemini (Function Calling) + Curva de Evolução + Extrato Projetado */}
          <div className="lg:col-span-7 space-y-6">
            <LiquidityStepChart />
            <GeminiCopilotCard />
            <CommitmentsLedger onOpenNewEntryModal={() => setIsCreatingNew(true)} />
          </div>
        </div>
      </main>

      {/* Rodapé Discreto */}
      <footer className="mt-10 border-t border-[#151a28]/7 bg-white/60 py-5 px-4 sm:px-6 text-xs text-muted">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            <strong className="text-muted">{PRODUCT.name}</strong> · {PRODUCT.tagline} · Miguel Fernandes Costacurta
          </p>
          <div className="flex items-center gap-3 text-xs">
            <span>Protótipo funcional com dados fictícios</span>
            <span>·</span>
            <a
              href="/slides/index.html"
              className="text-brand font-medium hover:underline"
            >
              Abrir Slides da Apresentação
            </a>
          </div>
        </div>
      </footer>

      {/* Modal / Bottom Sheet de Simulação */}
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
