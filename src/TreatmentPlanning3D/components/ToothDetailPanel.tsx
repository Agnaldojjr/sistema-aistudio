import React from 'react';
import { usePlanning3D } from '../hooks/usePlanning3D';
import { ToothSurface, ToothCondition } from '../types';
import { isAnteriorTooth } from './ToothMesh';
import { Activity, X, PlusCircle, Trash2, ShieldCheck, Heart, Info, DollarSign } from 'lucide-react';

interface ToothDetailPanelProps {
  onClose?: () => void;
}

export function ToothDetailPanel({ onClose }: ToothDetailPanelProps) {
  const {
    viewerState,
    teeth,
    procedures,
    globalProcedures,
    selectTooth,
    updateToothCondition,
    addProcedure,
    removeProcedure,
    getToothState,
    getToothProcedures,
    onOpenProcedureManager,
  } = usePlanning3D();

  const activeTooth = viewerState.activeTooth;

  // Fechar gaveta com a tecla Escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (activeTooth === null) {
    return null;
  }

  const toothState = getToothState(activeTooth);
  const toothProcedures = getToothProcedures(activeTooth);
  const anterior = isAnteriorTooth(activeTooth);  return (
    <div className="flex flex-col gap-5 text-white h-full">
      {/* Cabeçalho da Gaveta com Fechar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Procedimentos Planejados</span>
          <h2 className="text-lg font-bold text-sky-400 mt-0.5">Dente {activeTooth} ({anterior ? 'Anterior' : 'Posterior'})</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          title="Fechar painel (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>



      {/* Notas adicionais */}
      <div className="pt-2">
        <p className="text-[10px] text-slate-400 font-semibold uppercase">Notas Clínicas:</p>
        <textarea
          value={toothState?.notes || ''}
          onChange={(e) => updateToothCondition(activeTooth, toothState?.condition || 'HEALTHY', e.target.value)}
          placeholder="Observações clínicas sobre o dente..."
          className="w-full mt-1.5 bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
          rows={2}
        />
      </div>

      {/* PROCEDIMENTOS (Inserção e Exclusão) */}
      <div className="border-t border-slate-800 pt-3 flex-1 flex flex-col min-h-0">
        <h4 className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2">Procedimentos Planejados</h4>
        
        {/* Adição Rápida */}
        <div className="bg-slate-900/40 p-2.5 border border-slate-800 rounded-lg mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[9px] text-slate-400 font-semibold uppercase">Lançamento Rápido:</p>
            <button
              onClick={() => onOpenProcedureManager?.()}
              className="text-[9px] text-sky-400 hover:text-sky-300 font-bold uppercase transition-colors"
            >
              Gerenciar Tabela
            </button>
          </div>
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1">
            {globalProcedures && globalProcedures.length > 0 ? (
              globalProcedures.map((proc: any) => (
                <button
                  key={proc.id}
                  onClick={() => addProcedure(activeTooth, proc.id, proc.price, proc.name)}
                  className="w-full flex items-center justify-between p-1.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-left text-[11px] rounded transition-colors"
                >
                  <span className="truncate text-slate-200 pr-1">{proc.name}</span>
                  <span className="text-sky-400 font-bold flex items-center shrink-0">
                    + R$ {proc.price.toFixed(0)}
                  </span>
                </button>
              ))
            ) : (
              <p className="text-[10px] text-slate-500 italic text-center py-2">Nenhum procedimento cadastrado.</p>
            )}
          </div>
        </div>

        {/* Lista de Procedimentos do Dente */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {toothProcedures.length > 0 ? (
              toothProcedures.map((proc) => (
                <div
                  key={proc.id}
                  className="flex items-center justify-between p-2 bg-slate-900 border border-slate-800/80 rounded-lg shadow-sm hover:border-slate-700 transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-[11px] font-semibold text-slate-200 truncate">{proc.procedure}</p>
                    <p className="text-[9px] text-slate-400 font-semibold mt-0.5">R$ {proc.price.toFixed(2)}</p>
                  </div>
                  <button
                    onClick={() => removeProcedure(proc.id)}
                    className="p-1 rounded bg-slate-800/50 hover:bg-red-950 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-900 transition-colors shrink-0"
                    title="Remover procedimento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-[11px] text-slate-500 italic py-4 text-center">Nenhum procedimento associado a este dente.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
