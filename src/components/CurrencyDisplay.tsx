import React from 'react';
import { motion } from 'motion/react';
import { Cents } from '../domain/types';
import { splitBRLParts } from '../domain/money';

interface CurrencyDisplayProps {
  cents: Cents;
  className?: string;
  showPlusSign?: boolean;
  compactSymbol?: boolean;
}

/**
 * Tipografia monetária editorial em Geist Sans com alinhamento tabular (tabular-nums)
 * e proporção balanceada para símbolo R$ e centavos (,00), evitando estética fria de terminal.
 */
export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  cents,
  className = '',
  showPlusSign = false,
  compactSymbol = true,
}) => {
  const { sign, integerPart, decimalPart } = splitBRLParts(cents);
  const displaySign = sign === '-' ? '−' : showPlusSign && cents > 0 ? '+' : '';

  if (!compactSymbol) {
    return (
      <motion.span
        key={cents}
        initial={{ opacity: 0.7, y: 2 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className={`font-tabular whitespace-nowrap ${className}`}
      >
        {displaySign}R$ {integerPart}
        {decimalPart}
      </motion.span>
    );
  }

  return (
    <motion.span
      key={cents}
      initial={{ opacity: 0.7, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
      className={`font-tabular inline-flex items-baseline whitespace-nowrap ${className}`}
    >
      {displaySign && <span className="mr-0.5">{displaySign}</span>}
      <span className="[font-size:max(12px,0.66em)] font-semibold mr-1">R$</span>
      <span>{integerPart}</span>
      <span className="[font-size:max(12px,0.66em)] font-semibold">{decimalPart}</span>
    </motion.span>
  );
};
