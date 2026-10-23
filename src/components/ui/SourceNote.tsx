import { formatShortDatePT } from '../../domain/date';
export function SourceNote({ referenceDate, children }: {referenceDate: string; children?: React.ReactNode}) {
  return <p className="text-xs text-muted leading-relaxed">Dados fictícios de demonstração · Referência: <time dateTime={referenceDate}>{formatShortDatePT(referenceDate)} de {referenceDate.slice(0,4)}</time>. {children || 'Valores em R$, calculados pelo motor determinístico. Não são dados bancários ao vivo.'}</p>;
}
