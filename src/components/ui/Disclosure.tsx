import type { ReactNode } from 'react';
export function Disclosure({ title, children }: {title:string; children:ReactNode}) {
  return <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <summary className="cursor-pointer min-h-11 content-center font-semibold text-sm text-brand">{title}</summary>
    <div className="pt-3 text-sm text-muted space-y-2">{children}</div>
  </details>;
}
