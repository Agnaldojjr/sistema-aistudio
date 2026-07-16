import React from 'react';
import { usePlanning3D } from '../hooks/usePlanning3D';
import { LayerKey } from '../types';
import { Eye, EyeOff, Sliders } from 'lucide-react';

interface LayerItem {
  key: LayerKey;
  label: string;
  color: string;
}

const LAYERS: LayerItem[] = [
  { key: 'gums', label: 'Gengiva', color: 'bg-rose-400' },
  { key: 'bone', label: 'Osso Alvéolo', color: 'bg-slate-200' },
  { key: 'teeth', label: 'Dentes (Esmalte)', color: 'bg-white border border-slate-300' },
  { key: 'roots', label: 'Raízes', color: 'bg-slate-400' },
  { key: 'pulp', label: 'Polpa (Nervo)', color: 'bg-rose-500' },
  { key: 'canals', label: 'Canais Radiculares', color: 'bg-red-500' },
  { key: 'nerves', label: 'Nervo Mandibular', color: 'bg-amber-400' },
  { key: 'sinus', label: 'Seio Maxilar', color: 'bg-emerald-300' },
];

export function LayersPanel() {
  const { viewerState, setLayerVisibility, setLayerOpacity } = usePlanning3D();

  return (
    <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-5 shadow-2xl w-full max-w-xs space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <Sliders className="w-4 h-4 text-brand-gold" />
        <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Camadas Anatômicas</h3>
      </div>

      <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
        {LAYERS.map((layer) => {
          const config = viewerState.layers[layer.key];
          if (!config) return null;

          return (
            <div key={layer.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`w-3 h-3 rounded-full ${layer.color}`} />
                  <span className="text-xs font-semibold text-slate-300">{layer.label}</span>
                </div>

                <button
                  onClick={() => setLayerVisibility(layer.key, !config.visible)}
                  className={`p-1 rounded transition-colors ${
                    config.visible
                      ? 'text-sky-400 hover:bg-sky-500/10'
                      : 'text-slate-500 hover:bg-slate-800'
                  }`}
                  title={config.visible ? 'Ocultar camada' : 'Exibir camada'}
                >
                  {config.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              {config.visible && (
                <div className="flex items-center gap-3 pl-5">
                  <span className="text-[10px] text-slate-500 w-8">Opacidade</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={config.opacity}
                    onChange={(e) => setLayerOpacity(layer.key, parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-gold"
                    aria-label={`Opacidade da camada ${layer.label}`}
                  />
                  <span className="text-[10px] text-slate-400 font-mono w-8 text-right">
                    {Math.round(config.opacity * 100)}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default LayersPanel;
