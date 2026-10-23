import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Info,
  RotateCcw,
} from 'lucide-react';
import { useFinancialStore } from '../state/useFinancialStore';
import { AlertStatus } from '../domain/types';

const STATUS_BADGE_MAP: Record<
  AlertStatus,
  { label: string; dotColor: string; pillClass: string }
> = {
  NO_SHORTFALL_IDENTIFIED: {
    label: 'Sem Insuficiência',
    dotColor: 'bg-[#00E58F]',
    pillClass: 'border-emerald-500/30 bg-emerald-950/60 text-emerald-300',
  },
  CONDITIONAL_WARNING: {
    label: 'Aviso Condicional',
    dotColor: 'bg-amber-400',
    pillClass: 'border-amber-500/30 bg-amber-950/60 text-amber-300',
  },
  PREVENTIVE_ALERT: {
    label: 'Alerta Preventivo',
    dotColor: 'bg-rose-400',
    pillClass: 'border-rose-500/30 bg-rose-950/60 text-rose-300',
  },
  INSUFFICIENT_DATA: {
    label: 'Dados Insuficientes',
    dotColor: 'bg-slate-400',
    pillClass: 'border-slate-500/30 bg-slate-800 text-slate-300',
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
  const [showContextNote, setShowContextNote] = useState(false);

  useEffect(() => {
    if (!drawerOpen && !showContextNote) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        setShowContextNote(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, showContextNote]);

  return (
    <header className="sticky top-0 z-40 bg-[#04101A] text-white border-b border-[#14354D]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between gap-2 min-h-[48px] py-1.5">
          {/* Esquerda: Identificador de Ambiente Demonstrativo */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[5px] bg-[#0C2538] border border-[#1E4968] text-[11px] font-mono-tabular font-semibold tracking-wider uppercase text-[#00E58F] shrink-0">
              <FlaskConical className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cenário Demo</span>
              <span>
                {activeScenario.index}/{scenarios.length}
              </span>
            </span>

            {/* Seletor Principal de Cenário (Alvo >= 40px) */}
            <button
              type="button"
              onClick={() => setDrawerOpen((prev) => !prev)}
              aria-expanded={drawerOpen}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] bg-[#0B2234] hover:bg-[#113048] border border-[#1D4360] text-left transition-colors min-h-[38px] max-w-[230px] sm:max-w-none truncate cursor-pointer"
            >
              <span className="text-xs sm:text-sm font-semibold text-white truncate">
                {activeScenario.shortTitle}:{' '}
                <span className="font-normal text-slate-300 hidden md:inline">
                  {activeScenario.title}
                </span>
              </span>
              <ChevronDown
                className={`w-4 h-4 text-[#00E58F] shrink-0 transition-transform duration-200 ${
                  drawerOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>

          {/* Direita: Navegação Rápida Anterior/Próximo + Guia do Avaliador + Reset */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowContextNote((prev) => !prev)}
              aria-expanded={showContextNote}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-xs font-medium border transition-colors min-h-[38px] cursor-pointer ${
                showContextNote
                  ? 'bg-[#0052CC] border-[#3B82F6] text-white'
                  : 'bg-[#0B2234] border-[#1D4360] text-slate-200 hover:bg-[#113048]'
              }`}
              title="Ver explicação técnica deste cenário"
            >
              <Info className="w-3.5 h-3.5 text-[#00E58F]" />
              <span className="hidden lg:inline">Contexto do Caso</span>
            </button>

            {simulationDelta.hasChanges && (
              <button
                type="button"
                onClick={resetAllSimulations}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors min-h-[38px] cursor-pointer"
                title="Restaurar dados originais do cenário"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Restaurar Original</span>
              </button>
            )}

            <div className="inline-flex items-center rounded-[6px] bg-[#0B2234] border border-[#1D4360] p-0.5">
              <button
                type="button"
                onClick={() => stepScenario('prev')}
                aria-label="Cenário anterior"
                className="p-1.5 hover:bg-[#163A54] rounded-[4px] text-slate-200 transition-colors min-w-[34px] min-h-[34px] flex items-center justify-center cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="w-[1px] h-4 bg-[#1D4360]" />
              <button
                type="button"
                onClick={() => stepScenario('next')}
                aria-label="Próximo cenário"
                className="p-1.5 hover:bg-[#163A54] rounded-[4px] text-slate-200 transition-colors min-w-[34px] min-h-[34px] flex items-center justify-center cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Nota de Contexto do Cenário para Apresentação Técnica */}
        {showContextNote && (
          <div className="py-3 border-t border-[#14354D] text-xs sm:text-sm text-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#061826]/90">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#00E58F]">
                  Perfil: {activeScenario.personaName}
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-300">{activeScenario.personaProfile}</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                <strong className="text-white">O que este caso demonstra:</strong>{' '}
                {activeScenario.interviewHighlight}
              </p>
              <p className="text-[#00E58F] font-medium">
                💡 Dica de teste: {activeScenario.suggestedActionHint}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowContextNote(false)}
              className="self-start sm:self-center px-3 py-1.5 rounded-[5px] bg-[#113048] hover:bg-[#1A4363] text-xs font-semibold text-white shrink-0 cursor-pointer"
            >
              Fechar nota
            </button>
          </div>
        )}

        {/* Gaveta de Seleção Rápida dos 7 Cenários */}
        {drawerOpen && (
          <div className="py-3 border-t border-[#14354D] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 max-h-[72vh] overflow-y-auto">
            {scenarios.map((scen) => {
              const isSelected = scen.id === activeScenario.id;
              const badge = STATUS_BADGE_MAP[scen.expectedAlert];
              return (
                <button
                  key={scen.id}
                  type="button"
                  onClick={() => {
                    selectScenario(scen.id);
                    setDrawerOpen(false);
                  }}
                  className={`flex flex-col justify-between p-3 rounded-[8px] border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#0F2E46] border-[#00E58F] ring-1 ring-[#00E58F]/50'
                      : 'bg-[#081D2E] border-[#163A54] hover:border-[#2A5C82] hover:bg-[#0C263B]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Caso 0{scen.index}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold border ${badge.pillClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-white leading-snug mb-1">
                      {scen.title}
                    </p>
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {scen.interviewHighlight}
                    </p>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-[#14354D] flex items-center justify-between text-[11px] text-slate-400">
                    <span>{scen.personaName}</span>
                    <span className="text-[#00E58F] font-semibold">
                      {isSelected ? 'Ativo' : 'Carregar →'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
};
