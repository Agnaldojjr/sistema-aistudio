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
    selectTooth,
    selectSurface,
    updateToothCondition,
    updateToothSurfaceCondition,
    addProcedure,
    removeProcedure,
    getToothState,
    getSurfaceCondition,
    getToothProcedures,
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
  const anterior = isAnteriorTooth(activeTooth);
  const topSurface: ToothSurface = anterior ? 'I' : 'O';

  // Procedimentos Disponíveis para Inserção Rápida
  const AVAILABLE_PROCEDURES = [
    { name: 'Restauração de Resina', price: 250.00 },
    { name: 'Tratamento de Canal (Endodontia)', price: 800.00 },
    { name: 'Implante de Titânio', price: 2500.00 },
    { name: 'Faceta de Porcelana', price: 1800.00 },
    { name: 'Coroa Provisória', price: 400.00 },
  ];

  // Opções de condições clínicas
  const CONDITIONS: { id: ToothCondition; label: string; colorClass: string }[] = [
    { id: 'HEALTHY', label: 'Saudável', colorClass: 'bg-emerald-600 hover:bg-emerald-700' },
    { id: 'CARIES', label: 'Cárie', colorClass: 'bg-red-600 hover:bg-red-700' },
    { id: 'FRACTURE', label: 'Fratura', colorClass: 'bg-rose-600 hover:bg-rose-700' },
    { id: 'PULPITIS', label: 'Necessita Canal', colorClass: 'bg-red-800 hover:bg-red-900' },
    { id: 'IMPLANT', label: 'Implante', colorClass: 'bg-slate-500 hover:bg-slate-600' },
    { id: 'CROWN', label: 'Coroa/Prótese', colorClass: 'bg-amber-500 hover:bg-amber-600' },
    { id: 'MISSING', label: 'Dente Ausente', colorClass: 'bg-zinc-700 hover:bg-zinc-800' },
  ];

  const handleApplyCondition = (condition: ToothCondition) => {
    if (viewerState.activeSurfaces.length > 0) {
      viewerState.activeSurfaces.forEach((surface) => {
        updateToothSurfaceCondition(activeTooth, surface, condition);
      });
      // Limpa a seleção após aplicar a condição para evitar fadiga de cliques
      selectTooth(activeTooth);
    } else {
      updateToothCondition(activeTooth, condition);
    }
  };

  const getSurfaceLabel = (s: ToothSurface): string => {
    switch (s) {
      case 'M': return 'Mesial';
      case 'D': return 'Distal';
      case 'O': return 'Oclusal';
      case 'I': return 'Incisal';
      case 'V': return 'Vestibular';
      case 'L': return 'Lingual';
      case 'C': return 'Cervical';
    }
  };

  const getSurfaceColor = (s: ToothSurface): string => {
    if (toothState?.condition === 'IMPLANT') return 'bg-slate-400';
    if (toothState?.condition === 'CROWN') return 'bg-amber-400';

    const cond = getSurfaceCondition(activeTooth, s);
    switch (cond) {
      case 'CARIES':
      case 'FRACTURE':
        return 'bg-red-500';
      case 'IMPLANT':
        return 'bg-slate-400';
      case 'CROWN':
        return 'bg-amber-400';
      case 'HEALTHY':
      default:
        return viewerState.activeSurfaces.includes(s) ? 'bg-blue-500' : 'bg-slate-800';
    }
  };

  // Helper para destacar bordas de superfícies selecionadas com anel de brilho
  const getActiveClass = (s: ToothSurface): string => {
    return viewerState.activeSurfaces.includes(s)
      ? 'border-sky-400 ring-2 ring-sky-500 ring-offset-2 ring-offset-slate-950 scale-105 z-10 shadow-[0_0_12px_rgba(56,189,248,0.5)]'
      : 'border-slate-700';
  };

  return (
    <div className="flex flex-col gap-5 text-white h-full">
      {/* Cabeçalho da Gaveta com Fechar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Diagnóstico Clínico</span>
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

      {/* Seletor 2D em Cruz */}
      <div className="flex flex-col items-center justify-center p-3 bg-slate-900 border border-slate-800 rounded-xl">
        <h4 className="text-[10px] text-slate-400 uppercase font-semibold mb-4">Selecionar Faces</h4>
        
        <div className="relative w-36 h-36 flex items-center justify-center">
          {/* Topo - Vestibular (V) */}
          <button
            onClick={() => selectSurface('V')}
            className={`absolute top-0 w-11 h-9 rounded-t-md transition-all border ${getActiveClass('V')} ${getSurfaceColor('V')}`}
            title="Vestibular (V)"
          >
            <span className="text-[9px] font-bold block text-center text-slate-300">V</span>
          </button>

          {/* Esquerda - Mesial (M) */}
          <button
            onClick={() => selectSurface('M')}
            className={`absolute left-0 w-9 h-11 rounded-l-md transition-all border ${getActiveClass('M')} ${getSurfaceColor('M')}`}
            title="Mesial (M)"
          >
            <span className="text-[9px] font-bold block text-center text-slate-300">M</span>
          </button>

          {/* Centro - Oclusal / Incisal */}
          <button
            onClick={() => selectSurface(topSurface)}
            className={`w-11 h-11 rounded-md transition-all border shadow-md ${getActiveClass(topSurface)} ${getSurfaceColor(topSurface)}`}
            title={anterior ? 'Incisal (I)' : 'Oclusal (O)'}
          >
            <span className="text-xs font-bold block text-center text-white">{topSurface}</span>
          </button>

          {/* Direita - Distal (D) */}
          <button
            onClick={() => selectSurface('D')}
            className={`absolute right-0 w-9 h-11 rounded-r-md transition-all border ${getActiveClass('D')} ${getSurfaceColor('D')}`}
            title="Distal (D)"
          >
            <span className="text-[9px] font-bold block text-center text-slate-300">D</span>
          </button>

          {/* Base - Lingual (L) */}
          <button
            onClick={() => selectSurface('L')}
            className={`absolute bottom-0 w-11 h-9 rounded-b-md transition-all border ${getActiveClass('L')} ${getSurfaceColor('L')}`}
            title="Lingual (L)"
          >
            <span className="text-[9px] font-bold block text-center text-slate-300">L</span>
          </button>
        </div>

        {/* Cervical (C) */}
        <div className="w-full mt-4 px-2">
          <button
            onClick={() => selectSurface('C')}
            className={`w-full py-1.5 rounded-lg border transition-all ${getActiveClass('C')} ${getSurfaceColor('C')} flex items-center justify-center gap-1.5`}
          >
            <span className="text-[10px] font-bold uppercase text-slate-300">Cervical</span>
            <span className="text-[8px] bg-slate-950 px-1 py-0.5 rounded font-bold text-slate-400">C</span>
          </button>
        </div>
      </div>

      {/* Faces selecionadas */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] text-slate-400 font-semibold uppercase">Superfícies selecionadas:</p>
          <div className="flex gap-2.5">
            <button
              onClick={() => selectTooth(activeTooth)}
              className="text-[9px] text-slate-500 hover:text-sky-400 font-bold uppercase transition-colors"
              disabled={viewerState.activeSurfaces.length === 0}
            >
              Limpar
            </button>
            <button
              onClick={() => {
                const allSurfaces: ToothSurface[] = ['V', 'M', topSurface, 'D', 'L', 'C'];
                allSurfaces.forEach(s => {
                  if (!viewerState.activeSurfaces.includes(s)) {
                    selectSurface(s);
                  }
                });
              }}
              className="text-[9px] text-slate-500 hover:text-sky-400 font-bold uppercase transition-colors"
            >
              Todas
            </button>
          </div>
        </div>
        {viewerState.activeSurfaces.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {viewerState.activeSurfaces.map((s) => (
              <span key={s} className="px-2 py-0.5 bg-sky-950 border border-sky-800 text-sky-300 text-[10px] rounded font-semibold flex items-center gap-1">
                <span>{getSurfaceLabel(s)} ({s})</span>
                <button
                  onClick={() => selectSurface(s)}
                  className="text-sky-500 hover:text-white font-bold ml-0.5 text-xs line-height-0"
                  title="Remover"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="bg-slate-900/50 border border-slate-800/80 p-2.5 rounded-lg text-slate-400 text-[11px] italic">
            Nenhuma face selecionada. Condições afetarão o dente inteiro.
          </div>
        )}
      </div>

      {/* Ações de Condição */}
      <div className="border-t border-slate-800 pt-3">
        <h4 className="text-[10px] text-slate-400 uppercase font-semibold mb-2">Definir Condição Diagnóstica:</h4>
        <div className="grid grid-cols-2 gap-1.5">
          {CONDITIONS.map((cond) => (
            <button
              key={cond.id}
              onClick={() => handleApplyCondition(cond.id)}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold text-white shadow-sm transition-all ${cond.colorClass}`}
            >
              {cond.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notas adicionais */}
      <div className="border-t border-slate-800 pt-3">
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
          <p className="text-[9px] text-slate-400 font-semibold mb-1.5 uppercase">Lançamento de Procedimentos:</p>
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1">
            {AVAILABLE_PROCEDURES.map((proc) => (
              <button
                key={proc.name}
                onClick={() => addProcedure(activeTooth, proc.name, proc.price)}
                className="w-full flex items-center justify-between p-1.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-left text-[11px] rounded transition-colors"
              >
                <span className="truncate text-slate-200 pr-1">{proc.name}</span>
                <span className="text-sky-400 font-bold flex items-center shrink-0">
                  + R$ {proc.price.toFixed(0)}
                </span>
              </button>
            ))}
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
