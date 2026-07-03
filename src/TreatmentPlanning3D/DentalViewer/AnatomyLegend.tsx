import React from 'react';
import { Info } from 'lucide-react';

export function AnatomyLegend() {
  const legendItems = [
    { label: 'Saudável', color: 'bg-white border border-slate-700' },
    { label: 'Patologia (Cárie/Fratura)', color: 'bg-red-500' },
    { label: 'Implante (Titânio)', color: 'bg-gray-400' },
    { label: 'Coroa / Reabilitado', color: 'bg-amber-500' },
    { label: 'Dente Selecionado', color: 'bg-blue-500' },
  ];

  return (
    <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-4 shadow-2xl space-y-3">
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-brand-gold" />
        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Legenda de Condições</h4>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
            <span className="text-[10px] text-slate-400 font-medium">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
export default AnatomyLegend;
