import { Cents } from './types';

/**
 * Valida se o valor em centavos é um inteiro seguro, arredondando apenas caso venha de borda externa
 */
export function toSafeCents(value: number): Cents {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const rounded = Math.round(value);
  if (!Number.isSafeInteger(rounded)) {
    throw new RangeError(`Valor monetário fora do limite seguro de inteiros: ${value}`);
  }
  return rounded;
}

export function addCents(a: Cents, b: Cents): Cents {
  return toSafeCents(a + b);
}

export function subtractCents(a: Cents, b: Cents): Cents {
  return toSafeCents(a - b);
}

/**
 * Formata centavos inteiros para moeda brasileira (ex: 142050 -> "R$ 1.420,50")
 */
export function formatBRL(cents: Cents, options?: { showPlusSign?: boolean }): string {
  const safe = toSafeCents(cents);
  const isNegative = safe < 0;
  const absReais = Math.abs(safe) / 100;

  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absReais);

  if (isNegative) {
    return `-${formatted}`;
  }
  if (options?.showPlusSign && safe > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

/**
 * Divide um valor em centavos nas partes estruturais para tipografia de alta precisão
 * (ex: sinal, prefixo R$, parte inteira formatada "1.420" e centavos ",50")
 */
export function splitBRLParts(cents: Cents): {
  sign: '-' | '+' | '';
  integerPart: string;
  decimalPart: string;
} {
  const safe = toSafeCents(cents);
  const sign = safe < 0 ? '-' : '';
  const absCents = Math.abs(safe);
  const integerValue = Math.floor(absCents / 100);
  const decimalValue = absCents % 100;

  const integerPart = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 0,
  }).format(integerValue);

  const decimalPart = `,${String(decimalValue).padStart(2, '0')}`;

  return {
    sign,
    integerPart,
    decimalPart,
  };
}

/**
 * Converte texto digitado pelo usuário (ex: "1.250,50" ou "1250.50") em centavos inteiros
 */
export function parseBRLInputToCents(raw: string): Cents | null {
  const cleaned = raw.replace(/[R$\s]/g, '').trim();
  if (!cleaned) return null;

  let normalized = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.');
  }

  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return null;
  }
  return toSafeCents(Math.round(parsed * 100));
}
