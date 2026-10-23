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
 * Renderiza valores monetários em Reais com alinhamento tabular (JetBrains Mono),
 * proporção de 0.74em para o símbolo R$ e centavos (,00), e microtransição fluida
 * sempre que o valor muda por simulação ou troca de cenário.
 */
export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  cents,
  className = '',
  showPlusSign = false,
  compactSymbol = true,
}) => {
  const { sign, integerPart, decimalPart } = splitBRLParts(cents);
  const displaySign = sign === '-' ? '-' : showPlusSign && cents > 0 ? '+' : '';

  if (!compactSymbol) {
    return (
      <motion.span
        key={cents}
        initial={{ opacity: 0.65, y: 2 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className={`font-mono-tabular whitespace-nowrap ${className}`}
      >
        {displaySign}R$ {integerPart}
        {decimalPart}
      </motion.span>
    );
  }

  return (
    <motion.span
      key={cents}
      initial={{ opacity: 0.65, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
      className={`font-mono-tabular inline-flex items-baseline whitespace-nowrap ${className}`}
    >
      {displaySign && <span className="mr-0.5">{displaySign}</span>}
      <span className="text-[0.72em] font-medium opacity-75 mr-1">R$</span>
      <span>{integerPart}</span>
      <span className="text-[0.74em] font-medium opacity-75">{decimalPart}</span>
    </motion.span>
  );
};
