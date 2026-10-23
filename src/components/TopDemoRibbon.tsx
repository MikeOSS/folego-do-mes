import React, { useState } from 'react';
import { AccessibleDialog } from './ui/AccessibleDialog';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Presentation,
  RotateCcw,
} from 'lucide-react';
import { useFinancialStore } from '../state/useFinancialStore';
import { AlertStatus } from '../domain/types';

const STATUS_DOT_MAP: Record<AlertStatus, string> = {
  NO_SHORTFALL_IDENTIFIED: 'bg-[#2fc750]',
  CONDITIONAL_WARNING: 'bg-[#e8a020]',
  PREVENTIVE_ALERT: 'bg-[#e04545]',
  INSUFFICIENT_DATA: 'bg-[#94a3b8]',
};

const STATUS_LABEL_MAP: Record<AlertStatus, { label: string; style: string }> = {
  NO_SHORTFALL_IDENTIFIED: {
    label: 'Sem insuficiência',
    style: 'bg-[#2fc750]/12 text-[#168030] border-[#2fc750]/25',
  },
  CONDITIONAL_WARNING: {
    label: 'Aviso condicional',
    style: 'bg-[#e8a020]/12 text-[#a36200] border-[#e8a020]/30',
  },
  PREVENTIVE_ALERT: {
    label: 'Alerta preventivo',
    style: 'bg-[#e04545]/10 text-[#c93333] border-[#e04545]/25',
  },
  INSUFFICIENT_DATA: {
    label: 'Dados insuficientes',
    style: 'bg-slate-100 text-slate-600 border-slate-200',
  },
};

export const TopDemoRibbon: React.FC = () => {
  const {
    scenarios,
    activeScenario,
    selectScenario,
    stepScenario,
    simulationDelta,
    resetAllSimulations,
  } = useFinancialStore();

  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <header className="glass-bar sticky top-0 z-40 border-b border-[rgba(21,26,40,0.08)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 py-2 min-h-[60px]">
          {/* Esquerda: Marca Agi + Fôlego do Mês */}
          <div className="flex items-center gap-3 min-w-0">
            <a
              href="/"
              className="logo-tile inline-flex items-center rounded-[10px] px-2.5 py-1.5 shrink-0"
              aria-label="Fôlego do Mês"
            >
              <img
                src="/brand/agibank-logo.svg"
                alt="Agibank"
                className="h-5 w-auto block"
              />
            </a>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold tracking-tight text-[#151a28] truncate">
                  Fôlego do Mês
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-md border border-[rgba(21,26,40,0.08)] bg-white text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(21,26,40,0.52)]">
                  Case 2026
                </span>
              </div>
              <p className="text-xs text-[rgba(21,26,40,0.56)] truncate hidden sm:block">
                Antecipar o aperto. Dar tempo para agir.
              </p>
            </div>
          </div>

          {/* Centro / Direita: Seletor Elegante de Persona & Cenário + Link para os Slides */}
          <div className="flex flex-wrap items-center justify-between gap-2 w-full sm:w-auto min-w-0">
            {/* Pílula Seletora de Cenário */}
            <div className="flex flex-1 min-w-0 items-center rounded-full bg-white border border-[rgba(21,26,40,0.1)] p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => stepScenario('prev')}
                aria-label="Cenário anterior"
                className="p-1.5 rounded-full hover:bg-[#f0f2f7] text-[rgba(21,26,40,0.62)] hover:text-[#151a28] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setDrawerOpen((prev) => !prev)}
                aria-expanded={drawerOpen}
                aria-controls="scenario-picker"
                aria-haspopup="dialog"
                aria-label={`Escolher cenário: ${activeScenario.personaName}`}
                className="flex flex-1 min-w-0 items-center gap-1 px-1.5 py-1 rounded-full hover:bg-[#f0f2f7] transition-colors text-left cursor-pointer"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    STATUS_DOT_MAP[activeScenario.expectedAlert]
                  }`}
                />
                <span className="text-xs font-semibold text-[#151a28] max-w-[140px] sm:max-w-[240px] truncate">
                  {activeScenario.personaName}
                  <span className="font-normal text-[rgba(21,26,40,0.58)] hidden md:inline">
                    {' '}
                    · {activeScenario.title}
                  </span>
                </span>
                <span className="font-mono-tabular text-[10px] font-semibold text-[#0064fd] bg-[rgba(0,100,253,0.08)] px-1.5 py-0.5 rounded-full">
                  {activeScenario.index}/{scenarios.length}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[rgba(21,26,40,0.5)] transition-transform duration-200 ${
                    drawerOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={() => stepScenario('next')}
                aria-label="Próximo cenário"
                className="p-1.5 rounded-full hover:bg-[#f0f2f7] text-[rgba(21,26,40,0.62)] hover:text-[#151a28] transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {simulationDelta.hasChanges && (
              <button
                type="button"
                onClick={resetAllSimulations}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[rgba(0,100,253,0.09)] hover:bg-[rgba(0,100,253,0.15)] border border-[rgba(0,100,253,0.24)] text-[#0064fd] text-xs font-semibold transition-colors cursor-pointer"
                title="Restaurar dados originais do cenário"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Restaurar</span>
              </button>
            )}

            <a
              href="/slides/index.html"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir apresentação (abre em nova aba)"
                className="inline-flex items-center justify-center min-h-11 min-w-11 gap-1.5 px-3 py-1.5 rounded-full bg-[#0064fd] hover:bg-[#0052d6] text-white text-xs font-semibold shadow-2xs transition-colors"
              title="Abrir apresentação de slides do case (15 telas)"
            >
              <Presentation className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Apresentação</span>
            </a>
          </div>
        </div>

        {/* Painel Claro e Editorial de Seleção dos 7 Cenários */}
        <AccessibleDialog id="scenario-picker" open={drawerOpen} onClose={() => setDrawerOpen(false)} labelledBy="scenario-picker-title" className="scenario-dialog">
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 id="scenario-picker-title" className="text-lg font-semibold">Escolher cenário demonstrativo</h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Fechar menu de cenários"
                className="text-xs font-medium text-[#0064fd] hover:underline cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <p className="text-sm text-[#525b6e]">Dados fictícios para demonstração. Escolha uma situação para testar.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pb-1">
              {scenarios.map((scen) => {
                const isSelected = scen.id === activeScenario.id;
                const badge = STATUS_LABEL_MAP[scen.expectedAlert];
                return (
                  <button
                    key={scen.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      selectScenario(scen.id);
                      setDrawerOpen(false);
                    }}
                    className={`flex flex-col justify-between p-3.5 rounded-[14px] border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[rgba(0,100,253,0.05)] border-[rgba(0,100,253,0.38)] ring-1 ring-[rgba(0,100,253,0.2)]'
                        : 'bg-white border-[rgba(21,26,40,0.08)] hover:border-[rgba(0,100,253,0.24)] hover:bg-[#fcfdff]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono-tabular text-[10px] font-semibold uppercase tracking-widest text-[rgba(21,26,40,0.45)]">
                          0{scen.index} · {scen.personaName}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.style}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-[13px] font-semibold text-[#151a28] leading-snug mb-1">
                        {scen.title}
                      </p>
                      <p className="text-xs text-[rgba(21,26,40,0.6)] line-clamp-2 leading-relaxed">
                        {scen.interviewHighlight}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </AccessibleDialog>
      </div>
    </header>
  );
};
