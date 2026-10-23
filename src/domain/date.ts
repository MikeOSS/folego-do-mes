import { ISODateString } from './types';

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Verifica se uma string é uma data civil válida YYYY-MM-DD
 */
export function isValidISODate(dateStr: string): dateStr is ISODateString {
  const match = ISO_DATE_REGEX.exec(dateStr);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/**
 * Converte YYYY-MM-DD para timestamp UTC ao meio-dia (12:00:00Z),
 * eliminando 100% dos bugs de fuso horário (UTC-3) ou horário de verão.
 */
function toUTCNoonMs(dateStr: ISODateString): number {
  const match = ISO_DATE_REGEX.exec(dateStr);
  if (!match) {
    throw new Error(`Data ISO inválida: "${dateStr}". Esperado YYYY-MM-DD.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return Date.UTC(year, month - 1, day, 12, 0, 0);
}

/**
 * Soma (ou subtrai) dias civis a uma data YYYY-MM-DD de forma determinística
 */
export function addDaysISO(dateStr: ISODateString, daysToAdd: number): ISODateString {
  const baseMs = toUTCNoonMs(dateStr);
  const target = new Date(baseMs + daysToAdd * 86_400_000);
  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, '0');
  const d = String(target.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Retorna a diferença exata em dias civis (endDate - startDate)
 */
export function daysBetweenISO(startDate: ISODateString, endDate: ISODateString): number {
  const startMs = toUTCNoonMs(startDate);
  const endMs = toUTCNoonMs(endDate);
  return Math.round((endMs - startMs) / 86_400_000);
}

/**
 * Compara duas datas YYYY-MM-DD lexicograficamente (-1, 0, 1)
 */
export function compareISODates(a: ISODateString, b: ISODateString): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

const SHORT_MONTHS_PT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Formata YYYY-MM-DD para exibição compacta (ex: "14 nov" ou "14/11")
 */
export function formatShortDatePT(
  dateStr: ISODateString,
  style: 'textual' | 'numeric' = 'textual'
): string {
  const match = ISO_DATE_REGEX.exec(dateStr);
  if (!match) return dateStr;
  const day = match[3];
  const monthIndex = Number(match[2]) - 1;
  if (style === 'numeric') {
    return `${day}/${match[2]}`;
  }
  return `${day} ${SHORT_MONTHS_PT[monthIndex] ?? ''}`;
}

/**
 * Retorna o dia da semana abreviado em português (ex: "Sex")
 */
export function getWeekdayShortPT(dateStr: ISODateString): string {
  if (!isValidISODate(dateStr)) return '';
  const d = new Date(toUTCNoonMs(dateStr));
  return WEEKDAYS_PT[d.getUTCDay()] ?? '';
}
