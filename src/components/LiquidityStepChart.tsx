import React, { useMemo } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Calendar,
  Compass,
  Info,
  Zap,
} from 'lucide-react';
import { useFinancialStore } from '../state/useFinancialStore';
import { DailyProjection } from '../domain/types';
import { formatBRL } from '../domain/money';
import { formatShortDatePT, getWeekdayShortPT } from '../domain/date';

const SVG_WIDTH = 760;
const SVG_HEIGHT = 250;
const PAD_LEFT = 14;
const PAD_RIGHT = 64;
const PAD_TOP = 36;
const PAD_BOTTOM = 32;

function buildStepAfterPath(
  points: { x: number; y: number }[]
): string {
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
    const domainMax = rawMax + span * 0.15;
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
      <section className="tactile-card rounded-[12px] p-5 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#475869]">
              Horizonte de Liquidez (30 Dias)
            </span>
            <h2 className="text-base sm:text-lg font-bold text-[#091521]">
              Curva de Fôlego aguardando confirmação de saldo
            </h2>
          </div>
        </div>
        <div className="rounded-[8px] border border-dashed border-[#B8C5D1] bg-[#F4F6F8] p-6 text-center space-y-2">
          <Compass className="w-8 h-8 text-[#475869] mx-auto" />
          <p className="text-sm font-semibold text-[#091521]">
            Não desenhamos projeções sem dados confiáveis de saldo inicial
          </p>
          <p className="text-xs text-[#475869] max-w-md mx-auto">
            Informe um saldo livre no painel acima para destravar a simulação visual dos
            degraus de saldo.
          </p>
        </div>
      </section>
    );
  }

  const hasEstimatedDivergence = metrics.totalEstimatedOutflowsCents > 0;
  const hasUncertainInflows = metrics.totalUncertainInflowsCents > 0;
  const hasDeficit = metrics.firstShortfallDate !== null;

  return (
    <section
      aria-label="Gráfico de evolução do saldo em degraus"
      className="tactile-card rounded-[12px] p-4 sm:p-6 space-y-4"
    >
      {/* Cabeçalho + Legenda Técnica de Dupla Codificação (Acessível para Daltonismo) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DCE3EA] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#475869]">
              Curva de Fôlego • Patamares Diários
            </span>
            {simulationDelta.hasChanges && (
              <span className="px-1.5 py-0.5 rounded-[4px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono-tabular text-[10px] font-bold uppercase">
                Comparando c/ Original
              </span>
            )}
          </div>
          <h2 className="text-base sm:text-lg font-bold text-[#091521]">
            Evolução do Saldo nos Próximos 30 Dias
          </h2>
        </div>

        {/* Legenda com Forma + Traço */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-[#475869]">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="w-4 h-0.5 bg-[#00875A] inline-block" />
            <span>Saldo Projetado</span>
          </span>

          {hasEstimatedDivergence && (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="w-4 h-0 border-t-2 border-dashed border-[#475869] inline-block" />
              <span>Só Confirmados</span>
            </span>
          )}

          {hasUncertainInflows && (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="w-4 h-0 border-t-2 border-dotted border-[#0052CC] inline-block" />
              <span>C/ Receb. Incerto</span>
            </span>
          )}

          {hasDeficit && (
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#B91C1C]">
              <span className="w-3 h-3 rounded-[2px] bg-rose-100 border border-rose-500 inline-block" />
              <span>Zona de Déficit (&lt; R$ 0)</span>
            </span>
          )}
        </div>
      </div>

      {/* HUD Fixo do Dia Inspecionado (Zero colisão com o dedo no mobile!) */}
      {inspectedDay && (
        <div className="rounded-[8px] bg-[#EEF2F5] border border-[#DCE3EA] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="px-2.5 py-1 rounded-[5px] bg-[#061826] text-white font-mono-tabular text-xs font-bold uppercase">
              {formatShortDatePT(inspectedDay.date)} ({getWeekdayShortPT(inspectedDay.date)})
            </div>
            <div className="text-xs text-[#475869]">
              {inspectedDay.dayIndex === 0 ? (
                <span className="font-semibold text-[#091521]">Hoje (Ponto de partida)</span>
              ) : inspectedDay.entries.filter((e) => e.eligibility === 'included').length >
                0 ? (
                <span>
                  <strong className="text-[#091521]">
                    {inspectedDay.entries.filter((e) => e.eligibility === 'included').length}{' '}
                    movimentação(ões)
                  </strong>{' '}
                  neste dia
                </span>
              ) : (
                <span>Sem movimentações (patamar mantido)</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono-tabular">
            <div>
              <span className="text-[#475869] mr-1">Projetado:</span>
              <strong
                className={
                  inspectedDay.closingProjectedCents < 0
                    ? 'text-[#B91C1C] font-bold'
                    : 'text-[#00875A] font-bold'
                }
              >
                {formatBRL(inspectedDay.closingProjectedCents, { showPlusSign: true })}
              </strong>
            </div>

            {hasEstimatedDivergence && (
              <div>
                <span className="text-[#475869] mr-1">Só Firme:</span>
                <strong className="text-[#091521]">
                  {formatBRL(inspectedDay.closingConfirmedCents, { showPlusSign: true })}
                </strong>
              </div>
            )}

            {inspectedDay.intradayTimingRisk && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-amber-100 border border-amber-400 text-[#92400E] font-bold text-[11px]">
                <Zap className="w-3 h-3" />
                Mín. manhã: {formatBRL(inspectedDay.intradayMinCents)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Gráfico SVG Step-After com Hachura Arquitetônica abaixo de R$ 0 */}
      <figure className="relative select-none">
        <figcaption className="sr-only">
          Gráfico de evolução do saldo em degraus para 30 dias. Menor saldo projetado:{' '}
          {formatBRL(metrics.lowestProjectedBalanceCents)} em{' '}
          {formatShortDatePT(metrics.lowestProjectedBalanceDate)}.
        </figcaption>

        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full h-[210px] sm:h-[245px] overflow-visible touch-pan-y"
          role="img"
          aria-label="Curva de Fôlego em degraus"
        >
          <defs>
            {/* Hachura diagonal arquitetônica para Zona de Déficit (< R$ 0) */}
            <pattern
              id="deficit-hatch-pattern"
              width="8"
              height="8"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <rect width="8" height="8" fill="#FEF2F2" fillOpacity="0.9" />
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="8"
                stroke="#DC2626"
                strokeWidth="1.5"
                strokeOpacity="0.28"
              />
            </pattern>

            {/* Gradiente limpo para área positiva acima de R$ 0 */}
            <linearGradient id="positive-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00875A" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#00875A" stopOpacity="0.02" />
            </linearGradient>

            {/* Clip Acima de R$ 0 */}
            <clipPath id="clip-above-zero">
              <rect
                x="0"
                y="0"
                width={SVG_WIDTH}
                height={Math.max(0, chartGeometry.zeroY)}
              />
            </clipPath>

            {/* Clip Abaixo de R$ 0 (Zona de Insuficiência) */}
            <clipPath id="clip-below-zero">
              <rect
                x="0"
                y={chartGeometry.zeroY}
                width={SVG_WIDTH}
                height={Math.max(0, SVG_HEIGHT - chartGeometry.zeroY)}
              />
            </clipPath>
          </defs>

          {/* Fundo sutil da Zona Abaixo de Zero */}
          <rect
            x={PAD_LEFT}
            y={chartGeometry.zeroY}
            width={chartGeometry.plotW}
            height={Math.max(0, SVG_HEIGHT - PAD_BOTTOM - chartGeometry.zeroY)}
            fill="#FFF5F5"
            opacity="0.55"
          />

          {/* Preenchimento Positivo Acima de R$ 0 */}
          <path
            d={chartGeometry.areaPath}
            fill="url(#positive-area-grad)"
            clipPath="url(#clip-above-zero)"
          />

          {/* Preenchimento Hachurado Abaixo de R$ 0 (Vale de Déficit) */}
          <path
            d={chartGeometry.areaPath}
            fill="url(#deficit-hatch-pattern)"
            clipPath="url(#clip-below-zero)"
          />

          {/* Linha Fantasma do Cenário Original quando Simulação está Ativa */}
          {simulationDelta.hasChanges && (
            <path
              d={chartGeometry.baselineGhostPath}
              fill="none"
              stroke="#6366F1"
              strokeWidth="1.75"
              strokeDasharray="3 3"
              opacity="0.55"
            />
          )}

          {/* Curva Secundária: Apenas Confirmados (Tracejada) quando há Estimados */}
          {hasEstimatedDivergence && (
            <path
              d={chartGeometry.confirmedPath}
              fill="none"
              stroke="#475869"
              strokeWidth="1.75"
              strokeDasharray="6 4"
              opacity="0.85"
            />
          )}

          {/* Curva Terciária: Otimista (Pontilhada Azul) quando há Recebimento Incerto */}
          {hasUncertainInflows && (
            <path
              d={chartGeometry.optimisticPath}
              fill="none"
              stroke="#0052CC"
              strokeWidth="2"
              strokeDasharray="2 4"
            />
          )}

          {/* Régua Física de Nível Zero (R$ 0,00) */}
          <line
            x1={PAD_LEFT}
            y1={chartGeometry.zeroY}
            x2={SVG_WIDTH - PAD_RIGHT + 6}
            y2={chartGeometry.zeroY}
            stroke="#091521"
            strokeWidth="1.5"
          />
          <g
            transform={`translate(${SVG_WIDTH - PAD_RIGHT + 8}, ${chartGeometry.zeroY - 9})`}
          >
            <rect width="52" height="18" rx="3" fill="#091521" />
            <text
              x="26"
              y="12.5"
              textAnchor="middle"
              fill="#FFFFFF"
              className="font-mono-tabular text-[9.5px] font-bold"
            >
              R$ 0,00
            </text>
          </g>

          {/* Traço Primário Sólido: Acima de Zero (Verde Liquidez) */}
          <path
            d={chartGeometry.projectedPath}
            fill="none"
            stroke="#00875A"
            strokeWidth="2.75"
            strokeLinejoin="round"
            clipPath="url(#clip-above-zero)"
          />

          {/* Traço Primário Sólido: Abaixo de Zero (Crimson de Déficit) */}
          <path
            d={chartGeometry.projectedPath}
            fill="none"
            stroke={
              alertStatus === 'PREVENTIVE_ALERT' ? '#DC2626' : '#D97706'
            }
            strokeWidth="3"
            strokeLinejoin="round"
            clipPath="url(#clip-below-zero)"
          />

          {/* Guia Vertical do Dia Selecionado */}
          {inspectedDay && (
            <line
              x1={chartGeometry.getX(inspectedDay.dayIndex)}
              y1={PAD_TOP - 8}
              x2={chartGeometry.getX(inspectedDay.dayIndex)}
              y2={SVG_HEIGHT - PAD_BOTTOM}
              stroke="#091521"
              strokeWidth="1.25"
              strokeDasharray="3 3"
            />
          )}

          {/* Marcadores de Eventos nos Degraus com Movimentação + Callout Pins Diretos (Zero-Hover) */}
          {chartGeometry.projectedPoints.map(({ x, y, day }) => {
            const activeEntries = day.entries.filter(
              (e) => e.eligibility === 'included'
            );
            const isSelected = inspectedDay?.date === day.date;
            const isFirstDeficit = day.date === metrics.firstShortfallDate;
            const isIntraday = day.date === metrics.firstIntradayRiskDate;
            const isLowestPositive =
              metrics.firstShortfallDate === null &&
              day.date === metrics.lowestProjectedBalanceDate &&
              day.dayIndex > 0;
            const isMajorInflow =
              metrics.nextExpectedInflow?.entry.effectiveDate === day.date;

            if (
              activeEntries.length === 0 &&
              day.dayIndex !== 0 &&
              !isSelected
            ) {
              return null;
            }

            const dotFill =
              day.closingProjectedCents < 0
                ? '#DC2626'
                : isIntraday
                  ? '#D97706'
                  : day.confirmedInflowsCents > 0
                    ? '#0052CC'
                    : '#00875A';

            // Callout Pin Direto no SVG para os vértices principais
            const showCalloutPin =
              isFirstDeficit || isIntraday || isLowestPositive || isMajorInflow;
            const pinX = Math.max(
              PAD_LEFT + 54,
              Math.min(SVG_WIDTH - PAD_RIGHT - 54, x)
            );
            const pinAbove = y > PAD_TOP + 36;
            const pinBoxY = pinAbove ? y - 28 : y + 10;

            const pinLabel = isFirstDeficit
              ? `1º Déficit • ${formatShortDatePT(day.date, 'numeric')}`
              : isIntraday
                ? `Mesmo Dia • ${formatShortDatePT(day.date, 'numeric')}`
                : isLowestPositive
                  ? `Menor • ${formatShortDatePT(day.date, 'numeric')}`
                  : `Receb. • ${formatShortDatePT(day.date, 'numeric')}`;

            const pinBg = isFirstDeficit
              ? '#DC2626'
              : isIntraday
                ? '#D97706'
                : isMajorInflow
                  ? '#0052CC'
                  : '#061826';

            return (
              <g key={day.date}>
                {(isSelected || isFirstDeficit) && (
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? 7 : 6}
                    fill={dotFill}
                    opacity="0.22"
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 4.5 : 3.5}
                  fill="#FFFFFF"
                  stroke={dotFill}
                  strokeWidth="2.5"
                />
                {showCalloutPin && (
                  <g className="pointer-events-none">
                    <line
                      x1={x}
                      y1={y}
                      x2={pinX}
                      y2={pinAbove ? pinBoxY + 17 : pinBoxY}
                      stroke={pinBg}
                      strokeWidth="1"
                      opacity="0.7"
                    />
                    <rect
                      x={pinX - 50}
                      y={pinBoxY}
                      width="100"
                      height="17"
                      rx="3.5"
                      fill={pinBg}
                    />
                    <text
                      x={pinX}
                      y={pinBoxY + 11.5}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      className="font-mono-tabular text-[9px] font-bold"
                    >
                      {pinLabel}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Eixo X Simplificado (Datas de referência a cada 5 dias) */}
          {chartGeometry.projectedPoints
            .filter(
              ({ day }) =>
                day.dayIndex === 0 ||
                day.dayIndex % 5 === 0 ||
                day.dayIndex === dailySeries.length - 1
            )
            .map(({ x, day }) => (
              <text
                key={`axis-${day.date}`}
                x={x}
                y={SVG_HEIGHT - 8}
                textAnchor="middle"
                fill="#475869"
                className="font-mono-tabular text-[10px] font-medium"
              >
                {formatShortDatePT(day.date, 'numeric')}
              </text>
            ))}

          {/* Colunas Invisíveis de Toque/Scrubbing para cada um dos 31 dias */}
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

      {/* Pílulas Táteis de Marcos Críticos (Atalhos para Teclado e Polegar >= 40px) */}
      {milestones.length > 0 && (
        <div className="pt-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#475869] mb-2">
            <Calendar className="w-3.5 h-3.5" />
            <span>Saltar para marcos importantes na linha do tempo:</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {milestones.map((m) => {
              const isSelected = inspectedDay?.date === m.date;
              const isNegative = m.balanceCents < 0;
              const isIntraday = m.kind === 'intraday_risk';

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
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-[6px] border text-xs font-medium shrink-0 transition-all min-h-[40px] cursor-pointer ${
                    isSelected
                      ? 'bg-[#061826] border-[#061826] text-white shadow-xs'
                      : isNegative
                        ? 'bg-rose-50 border-rose-300 text-[#991B1B] hover:bg-rose-100'
                        : isIntraday
                          ? 'bg-amber-50 border-amber-300 text-[#92400E] hover:bg-amber-100'
                          : 'bg-[#F4F6F8] border-[#DCE3EA] text-[#091521] hover:bg-[#E6ECF2]'
                  }`}
                >
                  {isNegative ? (
                    <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                  ) : isIntraday ? (
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  ) : null}
                  <span>{m.label}</span>
                  <span
                    className={`font-mono-tabular font-bold ${
                      isSelected
                        ? 'text-[#00E58F]'
                        : isNegative
                          ? 'text-[#B91C1C]'
                          : 'text-[#00875A]'
                    }`}
                  >
                    {formatBRL(m.balanceCents)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Nota Sutil de Usabilidade */}
      <div className="flex items-center gap-1.5 text-[11px] text-[#475869]">
        <Info className="w-3.5 h-3.5 shrink-0 text-[#0052CC]" />
        <span>
          Toque em qualquer ponto do gráfico ou nos botões acima para inspecionar o saldo
          daquele dia e localizar os compromissos.
        </span>
      </div>
    </section>
  );
};
