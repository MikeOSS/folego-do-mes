import { parseBRLInputToCents } from '../domain/money';

/** UI boundary: reject partial parses and unsafe numbers without changing the engine. */
export function validateMoneyInput(value: string): number | null {
  if (!/^(?:R\$\s*)?[+-]?(?:\d+(?:[.,]\d{1,2})?|\d{1,3}(?:\.\d{3})+,\d{1,2})$/.test(value.trim())) return null;
  try {
    const cents = parseBRLInputToCents(value);
    // Demonstration inputs reserve ample arithmetic headroom for all projections.
    return cents !== null && Math.abs(cents) <= 10_000_000_000 ? cents : null;
  } catch { return null; }
}
