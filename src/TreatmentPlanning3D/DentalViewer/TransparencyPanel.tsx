import React from 'react';
import { usePlanning3D } from '../hooks/usePlanning3D';
import { Eye, Percent } from 'lucide-react';

export function TransparencyPanel() {
  const { viewerState, setLayerOpacity } = usePlanning3D();

  // Presets rápidos de transparência da gengiva
  const presets = [
    { label: 'Sólida', value: 0.95 },
    { label: '75%', value: 0.75 },
    { label: '50%', value: 0.5 },
    { label: '25%', value: 0.25 },
    { label: 'Raio-X', value: 0.1 },
  ];

  const currentGumsOpacity = viewerState.layers.gums?.opacity ?? 0.95;

  const handleApplyPreset = (value: number) => {
    setLayerOpacity('gums', value);
    // Também ajusta o osso proporcionalmente para melhor visualização clínica
    setLayerOpacity('bone', value > 0.5 ? 0.8 : value * 0.8);
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-4 shadow-2xl space-y-3">
      <div className="flex items-center gap-2">
        <Percent className="w-4 h-4 text-brand-gold" />
        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Transparência da Gengiva</h4>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          // Determina se o preset está ativo
          const isActive = Math.abs(currentGumsOpacity - preset.value) < 0.08;

          return (
            <button
              key={preset.label}
              onClick={() => handleApplyPreset(preset.value)}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
                isActive
                  ? 'bg-brand-gold text-slate-950 shadow-md font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
export default TransparencyPanel;
