import type { ReactNode } from 'react';

export function FeedbackState({ kind, children, onRetry }: { kind: 'loading' | 'error' | 'empty'; children: ReactNode; onRetry?: () => void }) {
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-xl border p-4 text-sm space-y-2 ${kind === 'error' ? 'border-red-200 text-danger bg-red-50' : 'border-slate-200 bg-slate-50 text-muted'}`}>
    <p>{children}</p>
    {onRetry && <button type="button" onClick={onRetry} className="underline font-semibold text-brand">Tentar novamente</button>}
  </div>;
}
