import React, { useState, useEffect } from 'react';
import { usePlanning3D } from '../hooks/usePlanning3D';
import { PlusCircle, Activity, X, ChevronLeft, Settings } from 'lucide-react';
import { motion, useDragControls } from 'motion/react';

export function ToothActionMenu() {
  const { viewerState, setViewingAnatomy, selectTooth, onOpenProcedureManager, globalProcedures, addProcedure, updateToothCondition } = usePlanning3D();
  const [view, setView] = useState<'MENU' | 'PROCEDURES'>('MENU');
  const dragControls = useDragControls();

  const [position, setPosition] = useState<{ x: number, y: number } | null>(null);

  // Sincroniza a posição inicial baseada no local do clique na tela
  useEffect(() => {
    if (viewerState.activeToothPos) {
      // Ajusta posição inicial um pouco acima do dente clicado
      setPosition({ x: viewerState.activeToothPos.x, y: viewerState.activeToothPos.y - 120 });
    } else {
      setPosition(null);
    }
  }, [viewerState.activeToothPos]);

  if (viewerState.activeTooth === null || viewerState.viewingAnatomy) {
    return null;
  }

  const toothNumber = viewerState.activeTooth;

  const style = position 
    ? { top: position.y, left: position.x }
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <motion.div 
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      className={`fixed z-[60] flex flex-col items-center animate-in zoom-in-95 fade-in duration-200 ${viewerState.activeToothPos && !position ? '-translate-x-1/2' : ''}`}
      style={style}
    >
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 p-5 rounded-2xl shadow-2xl flex flex-col gap-3 min-w-[280px] max-w-[320px]">
        
        {/* O cabeçalho funciona como alça para arrastar */}
        <div 
          onPointerDown={(e) => dragControls.start(e)}
          className="flex justify-between items-center mb-1 cursor-move active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-2">
            {view === 'PROCEDURES' && (
              <button 
                onPointerDown={(e) => e.stopPropagation()} 
                onClick={() => setView('MENU')} 
                className="p-1 bg-slate-800 hover:bg-slate-700 rounded-md text-slate-300 cursor-pointer"
              >
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
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => selectTooth(null)}
            className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {view === 'MENU' ? (
          <>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setViewingAnatomy(true)}
              className="w-full flex items-center justify-start gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all border border-slate-700 hover:border-slate-500 cursor-pointer text-left"
            >
              <Activity className="w-5 h-5 text-sky-400" />
              <span className="text-sm font-semibold">Ver Anatomia Individual</span>
            </button>

            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                updateToothCondition(toothNumber, 'MISSING');
                selectTooth(null);
              }}
              className="w-full flex items-center justify-start gap-3 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-slate-200 rounded-xl transition-all border border-slate-700 hover:border-zinc-500 cursor-pointer text-left"
            >
              <X className="w-5 h-5 text-zinc-400" />
              <span className="text-sm font-semibold">Marcar Dente Ausente</span>
            </button>

            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setView('PROCEDURES')}
              className="w-full flex items-center justify-start gap-3 px-4 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl transition-all border border-sky-500 shadow-lg shadow-sky-900/50 cursor-pointer text-left"
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
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    addProcedure(toothNumber, proc.id, proc.price, proc.name);
                    selectTooth(null);
                  }}
                  className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-700 rounded-lg text-left transition-colors border border-slate-700/50 hover:border-sky-500/50 cursor-pointer"
                >
                  <span className="text-sm text-slate-200 font-medium">{proc.name}</span>
                  <span className="text-xs text-emerald-400 font-bold ml-2">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proc.price)}
                  </span>
                </button>
              ))
            )}

            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onOpenProcedureManager?.()}
              className="mt-2 w-full flex items-center justify-center gap-2 p-2 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg transition-colors border border-slate-700 text-xs font-semibold cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              Gerenciar Catálogo
            </button>
          </div>
        )}

      </div>
    </motion.div>
  );
}
