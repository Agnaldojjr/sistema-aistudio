import React, { useState } from 'react';
import { usePlanning3D } from '../hooks/usePlanning3D';
import { Eye, EyeOff, PlusCircle, Activity, X, ChevronLeft, Settings } from 'lucide-react';

export function ToothActionMenu() {
  const { viewerState, setViewingAnatomy, toggleMissingTooth, selectTooth, onOpenProcedureManager, globalProcedures, addProcedure } = usePlanning3D();
  const [view, setView] = useState<'MENU' | 'PROCEDURES'>('MENU');

  if (viewerState.activeTooth === null || viewerState.viewingAnatomy) {
    return null;
  }

  const toothNumber = viewerState.activeTooth;
  const isMissing = viewerState.missingTeeth?.includes(toothNumber);

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center animate-in zoom-in-95 fade-in duration-200">
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 p-5 rounded-2xl shadow-2xl flex flex-col gap-3 min-w-[280px] max-w-[320px]">
        
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-2">
            {view === 'PROCEDURES' && (
              <button onClick={() => setView('MENU')} className="p-1 bg-slate-800 hover:bg-slate-700 rounded-md text-slate-300">
                <ChevronLeft size={16} />
              </button>
            )}
            <div className="flex flex-col">
              <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">
                {view === 'MENU' ? 'Ações do Dente' : 'Procedimentos'}
              </span>
              <span className="text-lg font-bold text-white">Dente {toothNumber}</span>
            </div>
          </div>
          <button 
            onClick={() => selectTooth(null)}
            className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {view === 'MENU' ? (
          <>
            <button
              onClick={() => setViewingAnatomy(true)}
              className="w-full flex items-center justify-start gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all border border-slate-700 hover:border-slate-500"
            >
              <Activity className="w-5 h-5 text-sky-400" />
              <span className="text-sm font-semibold">Ver Anatomia Individual</span>
            </button>

            <button
              onClick={() => {
                toggleMissingTooth(toothNumber);
                selectTooth(null);
              }}
              className="w-full flex items-center justify-start gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all border border-slate-700 hover:border-slate-500"
            >
              {isMissing ? (
                <>
                  <Eye className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-semibold">Restaurar Dente</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-5 h-5 text-rose-400" />
                  <span className="text-sm font-semibold">Ocultar Dente</span>
                </>
              )}
            </button>

            <button
              onClick={() => setView('PROCEDURES')}
              className="w-full flex items-center justify-start gap-3 px-4 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl transition-all border border-sky-500 shadow-lg shadow-sky-900/50"
            >
              <PlusCircle className="w-5 h-5" />
              <span className="text-sm font-bold">Adicionar Procedimento</span>
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {globalProcedures.length === 0 ? (
              <div className="text-sm text-slate-400 text-center py-4">Nenhum procedimento cadastrado.</div>
            ) : (
              globalProcedures.map((proc: any) => (
                <button
                  key={proc.id}
                  onClick={() => {
                    addProcedure(toothNumber, proc.id, proc.price, proc.name);
                    selectTooth(null);
                  }}
                  className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-700 rounded-lg text-left transition-colors border border-slate-700/50 hover:border-sky-500/50"
                >
                  <span className="text-sm text-slate-200 font-medium">{proc.name}</span>
                  <span className="text-xs text-emerald-400 font-bold ml-2">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proc.price)}
                  </span>
                </button>
              ))
            )}

            <button
              onClick={() => onOpenProcedureManager?.()}
              className="mt-2 w-full flex items-center justify-center gap-2 p-2 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg transition-colors border border-slate-700 text-xs font-semibold"
            >
              <Settings className="w-4 h-4" />
              Gerenciar Catálogo
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
