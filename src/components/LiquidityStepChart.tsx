import React, { useMemo } from 'react';
import { useFinancialStore } from '../state/useFinancialStore';
import { DailyProjection } from '../domain/types';
import { formatBRL } from '../domain/money';
import { formatShortDatePT, getWeekdayShortPT } from '../domain/date';
import { CurrencyDisplay } from './CurrencyDisplay';

const SVG_WIDTH = 760;
const SVG_HEIGHT = 230;
const PAD_LEFT = 14;
const PAD_RIGHT = 52;
const PAD_TOP = 24;
const PAD_BOTTOM = 28;

function buildStepAfterPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    d += ` L ${curr.x.toFixed(1)} ${prev.y.toFixed(1)} L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }
  return d;
}

function buildStepAfterAreaPath(
  points: { x: number; y: number }[],
  baselineY: number
): string {
  if (points.length === 0) return '';
  const linePath = buildStepAfterPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${last.x.toFixed(1)} ${baselineY.toFixed(1)} L ${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
}

export const LiquidityStepChart: React.FC = () => {
  const {
    activeProjection,
    baselineProjection,
    simulationDelta,
    selectedDate,
    setSelectedDate,
  } = useFinancialStore();

  const { alertStatus, dailySeries, metrics, milestones } = activeProjection;

  const inspectedDay: DailyProjection | null = useMemo(() => {
    if (dailySeries.length === 0) return null;
    if (selectedDate) {
      const found = dailySeries.find((d) => d.date === selectedDate);
      if (found) return found;
    }
    if (metrics.firstShortfallDate) {
      const shortfallDay = dailySeries.find(
        (d) => d.date === metrics.firstShortfallDate
      );
      if (shortfallDay) return shortfallDay;
    }
    if (metrics.firstIntradayRiskDate) {
      const intraDay = dailySeries.find(
        (d) => d.date === metrics.firstIntradayRiskDate
      );
      if (intraDay) return intraDay;
    }
    const lowestDay = dailySeries.find(
      (d) => d.date === metrics.lowestProjectedBalanceDate
    );
    return lowestDay ?? dailySeries[0];
  }, [dailySeries, selectedDate, metrics]);

  const chartGeometry = useMemo(() => {
    if (dailySeries.length === 0) return null;

    const plotW = SVG_WIDTH - PAD_LEFT - PAD_RIGHT;
    const plotH = SVG_HEIGHT - PAD_TOP - PAD_BOTTOM;

    const allValues: number[] = [0];
    for (const d of dailySeries) {
      allValues.push(
        d.closingProjectedCents,
        d.closingConfirmedCents,
        d.intradayMinCents
      );
      if (metrics.totalUncertainInflowsCents > 0) {
        allValues.push(d.closingOptimisticCents);
      }
    }
    if (simulationDelta.hasChanges) {
      for (const bd of baselineProjection.dailySeries) {
        allValues.push(bd.closingProjectedCents);
      }
    }

    const rawMin = Math.min(...allValues, -10_000);
    const rawMax = Math.max(...allValues, 50_000);
    const span = Math.max(10_000, rawMax - rawMin);
    const domainMin = rawMin < 0 ? rawMin - span * 0.14 : -span * 0.12;
    const domainMax = rawMax + span * 0.14;
    const totalRange = domainMax - domainMin;

    const getX = (dayIndex: number) =>
      PAD_LEFT + (dayIndex / Math.max(1, dailySeries.length - 1)) * plotW;

    const getY = (cents: number) =>
      PAD_TOP + ((domainMax - cents) / totalRange) * plotH;

    const zeroY = getY(0);

    const projectedPoints = dailySeries.map((d) => ({
      x: getX(d.dayIndex),
      y: getY(d.closingProjectedCents),
      day: d,
    }));

    const confirmedPoints = dailySeries.map((d) => ({
      x: getX(d.dayIndex),
      y: getY(d.closingConfirmedCents),
      day: d,
    }));

    const optimisticPoints = dailySeries.map((d) => ({
      x: getX(d.dayIndex),
      y: getY(d.closingOptimisticCents),
      day: d,
    }));

    const baselineGhostPoints = baselineProjection.dailySeries.map((d) => ({
      x: getX(d.dayIndex),
      y: getY(d.closingProjectedCents),
    }));

    return {
      plotW,
      plotH,
      zeroY,
      getX,
      getY,
      projectedPoints,
      confirmedPoints,
      optimisticPoints,
      projectedPath: buildStepAfterPath(projectedPoints),
      confirmedPath: buildStepAfterPath(confirmedPoints),
      optimisticPath: buildStepAfterPath(optimisticPoints),
      baselineGhostPath: buildStepAfterPath(baselineGhostPoints),
      areaPath: buildStepAfterAreaPath(projectedPoints, zeroY),
    };
  }, [
    dailySeries,
    metrics.totalUncertainInflowsCents,
    simulationDelta.hasChanges,
    baselineProjection.dailySeries,
  ]);

  if (alertStatus === 'INSUFFICIENT_DATA' || !chartGeometry) {
    return (
      <section className="surface-raised p-6 sm:p-7 space-y-3">
        <span className="label-caps">Evolução do saldo · 30 dias</span>
        <h2 className="text-base sm:text-lg font-semibold text-[#151a28]">
          Projeção aguardando confirmação de saldo
        </h2>
        <p className="text-sm text-[rgba(21,26,40,0.62)] leading-relaxed">
          Informe um saldo disponível no painel lateral para visualizar a evolução dia a dia
          dos próximos compromissos.
        </p>
      </section>
    );
  }

  const hasEstimatedDivergence = metrics.totalEstimatedOutflowsCents > 0;
  const hasUncertainInflows = metrics.totalUncertainInflowsCents > 0;
  const activeEntriesInInspectedDay = inspectedDay
    ? inspectedDay.entries.filter((e) => e.eligibility === 'included').length
    : 0;

  return (
    <section
      aria-label="Evolução do saldo nos próximos 30 dias"
      className="surface-raised p-6 sm:p-7 space-y-5"
    >
      {/* Topo Integrado: Leitor Vivo do Dia Inspecionado + Legenda Limpa */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <span className="label-caps">
            Evolução do saldo · Próximos 30 dias
          </span>

          {inspectedDay && (
            <div className="mt-1.5 flex flex-wrap items-baseline gap-2.5">
              <span
                className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                  inspectedDay.closingProjectedCents < 0
                    ? 'text-[#e04545]'
                    : 'text-[#151a28]'
                }`}
              >
                <CurrencyDisplay
                  cents={inspectedDay.closingProjectedCents}
                  showPlusSign={inspectedDay.closingProjectedCents > 0}
                />
              </span>

              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#f0f2f7] text-[12px] font-medium text-[rgba(21,26,40,0.72)]">
                {inspectedDay.dayIndex === 0
                  ? 'Hoje'
                  : `${formatShortDatePT(inspectedDay.date)} · ${getWeekdayShortPT(
                      inspectedDay.date
                    )}`}
              </span>
            </div>
          )}

          {inspectedDay && (
            <p className="text-xs text-[rgba(21,26,40,0.58)] mt-1">
              {inspectedDay.intradayTimingRisk ? (
                <span className="text-[#a36200] font-medium">
                  Atenção ao horário: saídas do dia superam o saldo da manhã (mínimo{' '}
                  {formatBRL(inspectedDay.intradayMinCents)}) antes da entrada.
                </span>
              ) : activeEntriesInInspectedDay > 0 ? (
                <span>
                  {activeEntriesInInspectedDay} movimentação(ões) considerada(s) nesta data
                  {hasEstimatedDivergence
                    ? ` · Só confirmados: ${formatBRL(
                        inspectedDay.closingConfirmedCents,
                        { showPlusSign: true }
                      )}`
                    : ''}
                </span>
              ) : (
                <span>
                  Sem movimentações nesta data
                  {hasEstimatedDivergence
                    ? ` · Só confirmados: ${formatBRL(
                        inspectedDay.closingConfirmedCents,
                        { showPlusSign: true }
                      )}`
                    : ''}
                </span>
              )}
            </p>
          )}
        </div>

        {/* Legenda Minimalista */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-[rgba(21,26,40,0.6)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 bg-[#0064fd] rounded-full inline-block" />
            <span>Saldo projetado</span>
          </span>

          {hasEstimatedDivergence && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-0 border-t-2 border-dashed border-[rgba(21,26,40,0.45)] inline-block" />
              <span>Só confirmados</span>
            </span>
          )}

          {hasUncertainInflows && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-0 border-t-2 border-dotted border-[#2fc750] inline-block" />
              <span>C/ receb. incerto</span>
            </span>
          )}
        </div>
      </div>

      {/* Gráfico SVG Step-After Limpo e Escultural */}
      <figure className="relative select-none">
        <figcaption className="sr-only">
          Gráfico de evolução do saldo para 30 dias. Menor saldo projetado:{' '}
          {formatBRL(metrics.lowestProjectedBalanceCents)} em{' '}
          {formatShortDatePT(metrics.lowestProjectedBalanceDate)}.
        </figcaption>

        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full h-[195px] sm:h-[220px] overflow-visible touch-pan-y"
          role="img"
          aria-label="Evolução do saldo por datas"
        >
          <defs>
            <linearGradient id="agi-pos-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0064fd" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#0064fd" stopOpacity="0.0" />
            </linearGradient>

            <linearGradient id="agi-neg-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e04545" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#e04545" stopOpacity="0.18" />
            </linearGradient>

            <clipPath id="clip-above-zero">
              <rect
                x="0"
                y="0"
                width={SVG_WIDTH}
                height={Math.max(0, chartGeometry.zeroY)}
              />
            </clipPath>

            <clipPath id="clip-below-zero">
              <rect
                x="0"
                y={chartGeometry.zeroY}
                width={SVG_WIDTH}
                height={Math.max(0, SVG_HEIGHT - chartGeometry.zeroY)}
              />
            </clipPath>
          </defs>

          {/* Preenchimento Positivo Acima de R$ 0 */}
          <path
            d={chartGeometry.areaPath}
            fill="url(#agi-pos-area)"
            clipPath="url(#clip-above-zero)"
          />

          {/* Preenchimento Suave Abaixo de R$ 0 */}
          <path
            d={chartGeometry.areaPath}
            fill="url(#agi-neg-area)"
            clipPath="url(#clip-below-zero)"
          />

          {/* Linha Fantasma do Original quando há Simulação Ativa */}
          {simulationDelta.hasChanges && (
            <path
              d={chartGeometry.baselineGhostPath}
              fill="none"
              stroke="rgba(21,26,40,0.28)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          )}

          {/* Curva Só Confirmados (Tracejada) */}
          {hasEstimatedDivergence && (
            <path
              d={chartGeometry.confirmedPath}
              fill="none"
              stroke="rgba(21,26,40,0.42)"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
          )}

          {/* Curva Otimista com Recebimento Incerto */}
          {hasUncertainInflows && (
            <path
              d={chartGeometry.optimisticPath}
              fill="none"
              stroke="#2fc750"
              strokeWidth="1.75"
              strokeDasharray="2 4"
            />
          )}

          {/* Linha de Nível Zero Elegante */}
          <line
            x1={PAD_LEFT}
            y1={chartGeometry.zeroY}
            x2={SVG_WIDTH - PAD_RIGHT}
            y2={chartGeometry.zeroY}
            stroke="rgba(21,26,40,0.18)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <text
            x={SVG_WIDTH - PAD_RIGHT + 8}
            y={chartGeometry.zeroY + 3.5}
            fill="rgba(21,26,40,0.45)"
            className="font-mono-tabular text-[10px] font-medium"
          >
            R$ 0
          </text>

          {/* Traço Principal Acima de Zero (Azul Agi #0064fd) */}
          <path
            d={chartGeometry.projectedPath}
            fill="none"
            stroke="#0064fd"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            clipPath="url(#clip-above-zero)"
          />

          {/* Traço Principal Abaixo de Zero (Vermelho #e04545 ou Âmbar #e8a020) */}
          <path
            d={chartGeometry.projectedPath}
            fill="none"
            stroke={alertStatus === 'PREVENTIVE_ALERT' ? '#e04545' : '#e8a020'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            clipPath="url(#clip-below-zero)"
          />

          {/* Guia Vertical do Dia Selecionado */}
          {inspectedDay && (
            <line
              x1={chartGeometry.getX(inspectedDay.dayIndex)}
              y1={PAD_TOP - 6}
              x2={chartGeometry.getX(inspectedDay.dayIndex)}
              y2={SVG_HEIGHT - PAD_BOTTOM}
              stroke="#0064fd"
              strokeWidth="1"
              strokeOpacity="0.35"
            />
          )}

          {/* Nós Discretos nos Dias com Movimentação */}
          {chartGeometry.projectedPoints.map(({ x, y, day }) => {
            const activeEntries = day.entries.filter(
              (e) => e.eligibility === 'included'
            );
            const isSelected = inspectedDay?.date === day.date;

            if (activeEntries.length === 0 && day.dayIndex !== 0 && !isSelected) {
              return null;
            }

            const dotColor =
              day.closingProjectedCents < 0
                ? '#e04545'
                : day.intradayTimingRisk
                  ? '#e8a020'
                  : day.confirmedInflowsCents > 0
                    ? '#2fc750'
                    : '#0064fd';

            return (
              <g key={day.date}>
                {isSelected && (
                  <circle cx={x} cy={y} r={8} fill={dotColor} opacity="0.16" />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 4.5 : 3}
                  fill="#ffffff"
                  stroke={dotColor}
                  strokeWidth={isSelected ? '2.5' : '2'}
                />
              </g>
            );
          })}

          {/* Datas no Eixo Horizontal */}
          {chartGeometry.projectedPoints
            .filter(
              ({ day }) =>
                day.dayIndex === 0 ||
                day.dayIndex % 6 === 0 ||
                day.dayIndex === dailySeries.length - 1
            )
            .map(({ x, day }) => (
              <text
                key={`axis-${day.date}`}
                x={x}
                y={SVG_HEIGHT - 6}
                textAnchor="middle"
                fill="rgba(21,26,40,0.45)"
                className="font-mono-tabular text-[10px]"
              >
                {formatShortDatePT(day.date, 'numeric')}
              </text>
            ))}

          {/* Colunas de Toque/Scrubbing */}
          {chartGeometry.projectedPoints.map(({ x, day }) => {
            const colW = chartGeometry.plotW / Math.max(1, dailySeries.length);
            return (
              <rect
                key={`hit-${day.date}`}
                x={x - colW / 2}
                y={0}
                width={colW}
                height={SVG_HEIGHT}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setSelectedDate(day.date)}
                onPointerDown={() => setSelectedDate(day.date)}
                onPointerMove={(e) => {
                  if (e.buttons === 1 || e.pointerType === 'touch') {
                    setSelectedDate(day.date);
                  }
                }}
                onClick={() => {
                  setSelectedDate(day.date);
                  const el = document.getElementById(`ledger-day-${day.date}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
              />
            );
          })}
        </svg>
      </figure>

      {/* Pílulas Minimalistas de Marcos Importantes */}
      {milestones.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
          {milestones.map((m) => {
            const isSelected = inspectedDay?.date === m.date;
            const isNegative = m.balanceCents < 0;
            const isIntraday = m.kind === 'intraday_risk';

            const dotClass = isNegative
              ? 'bg-[#e04545]'
              : isIntraday
                ? 'bg-[#e8a020]'
                : m.kind === 'salary_recovery'
                  ? 'bg-[#2fc750]'
                  : 'bg-[#0064fd]';

            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  setSelectedDate(m.date);
                  const el = document.getElementById(`ledger-day-${m.date}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-[#151a28] border-[#151a28] text-white'
                    : 'bg-[#f8f9fc] border-[rgba(21,26,40,0.08)] text-[rgba(21,26,40,0.75)] hover:bg-[#f0f2f7]'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                <span>{m.label}</span>
                <span
                  className={`font-tabular font-semibold ${
                    isSelected
                      ? 'text-white'
                      : isNegative
                        ? 'text-[#e04545]'
                        : 'text-[#151a28]'
                  }`}
                >
                  {formatBRL(m.balanceCents)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
