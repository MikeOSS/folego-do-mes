import { useEffect, useState } from 'react';

const COLLAPSED_KEY='folego-demo-collapsed-v1';
export function DemoGuide() {
  const [active,setActive]=useState(()=>new URLSearchParams(location.search).get('demo')==='1');
  const [collapsed,setCollapsed]=useState(()=>{
    try {return sessionStorage.getItem(COLLAPSED_KEY)==='true';} catch {return false;}
  });
  useEffect(()=>{
    const sync=()=>setActive(new URLSearchParams(location.search).get('demo')==='1');
    window.addEventListener('popstate',sync);
    return ()=>window.removeEventListener('popstate',sync);
  },[]);
  const toggleCollapsed=()=>{
    setCollapsed(previous=>{
      try{sessionStorage.setItem(COLLAPSED_KEY,String(!previous));}catch{/* Keep usable with storage disabled. */}
      return !previous;
    });
  };
  const toggleActive=()=>{
    const url=new URL(location.href);
    if(active)url.searchParams.delete('demo');else url.searchParams.set('demo','1');
    history.replaceState(history.state,'',url);
    setActive(!active);
  };
  if(!active)return <button type="button" onClick={toggleActive} className="mb-4 text-sm font-semibold text-brand underline">Iniciar demonstração guiada</button>;
  return <aside aria-label="Roteiro de demonstração" className="surface-raised p-3 mb-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-semibold">Demonstração · dados fictícios</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-expanded={!collapsed} aria-controls="demo-guide-steps" onClick={toggleCollapsed} className="text-sm text-brand underline">{collapsed?'Expandir roteiro':'Recolher roteiro'}</button>
        <button type="button" onClick={toggleActive} className="text-sm text-muted underline">Sair da demonstração</button>
      </div>
    </div>
    {!collapsed && <ol id="demo-guide-steps" className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3 text-sm text-muted list-decimal list-inside">
      <li>Escolha um dos sete cenários no topo.</li>
      <li><a className="text-brand underline" href="#evolucao-saldo">Entenda o saldo e veja os dados.</a></li>
      <li><a className="text-brand underline" href="#compromissos">Selecione uma conta para simular.</a></li>
      <li><a className="text-brand underline" href="#consultor">Peça orientação e confira a fonte.</a></li>
    </ol>}
  </aside>;
}
