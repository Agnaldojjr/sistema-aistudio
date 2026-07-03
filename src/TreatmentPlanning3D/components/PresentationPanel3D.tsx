import React, { useState } from 'react';
import { usePlanning3D } from '../hooks/usePlanning3D';
import { SignatureCanvas } from './SignatureCanvas';
import { DentalCanvas3D } from './DentalCanvas3D';
import { usePatientContext } from '../../context/PatientContext';
import { Monitor, Smartphone, ShieldCheck, CheckCircle2, ChevronRight, X, Heart } from 'lucide-react';

export function PresentationPanel3D() {
  const { viewerState, teeth, procedures, getPlanTotal, setSimulationState, setPresentationMode, acceptPlan, activePlan } = usePlanning3D();
  const { activeProposal } = usePatientContext();

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  const handleSaveSignature = (base64: string) => {
    setSignatureData(base64);
    acceptPlan();
    setShowSignatureModal(false);
  };

  // Teclas de atalho para navegação fácil no modo apresentação
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPresentationMode(false);
      } else if (e.key.toLowerCase() === 'a' || e.key === 'ArrowLeft') {
        setSimulationState('BEFORE');
      } else if (e.key.toLowerCase() === 'd' || e.key === 'ArrowRight') {
        setSimulationState('AFTER');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setPresentationMode, setSimulationState]);

  const getToothNumberForProcedure = (toothId: string) => {
    const toothObj = Object.values(teeth).find((t) => t.id === toothId);
    return toothObj ? `Dente ${toothObj.tooth}` : 'Geral';
  };

  const isAccepted = activePlan?.status === 'ACCEPTED';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/98 backdrop-blur flex flex-col p-6 animate-fade-in text-white">
      {/* Barra superior de ferramentas do modo apresentação */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-4">
        <div>
          <span className="text-[10px] text-sky-400 font-bold uppercase tracking-widest">Modo de Apresentação Clínica</span>
          <h2 className="text-xl font-bold tracking-tight text-white mt-0.5">
            Plano de Tratamento de {activeProposal.patientName || 'Paciente'}
          </h2>
        </div>
        <button
          onClick={() => setPresentationMode(false)}
          className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-all"
        >
          Sair da Apresentação
        </button>
      </div>

      {/* Grid Central */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6 min-h-0">
        
        {/* Lado Esquerdo - Visualizador Clínico Simplificado com o DentalCanvas3D ativo */}
        <div className="lg:col-span-3 bg-slate-900/40 border border-slate-900 rounded-3xl p-4 flex flex-col gap-4 relative min-h-[400px]">
          {/* Alternadores de Simulação Antes/Depois */}
          <div className="absolute top-6 left-6 z-10 flex gap-2">
            <button
              onClick={() => setSimulationState('BEFORE')}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl shadow-md border transition-all ${
                viewerState.simulationState === 'BEFORE'
                  ? 'bg-red-800 border-red-700 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
              }`}
            >
              Como Está Hoje (Antes)
            </button>
            <button
              onClick={() => setSimulationState('AFTER')}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl shadow-md border transition-all ${
                viewerState.simulationState === 'AFTER'
                  ? 'bg-emerald-600 border-emerald-500 text-white animate-pulse-gold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
              }`}
            >
              Resultado Projetado (Depois)
            </button>
          </div>

          <div className="flex-1 flex flex-col">
            <DentalCanvas3D />
          </div>

          {/* Legenda de Cores para o Paciente */}
          <div className="absolute bottom-6 left-6 bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 shadow-xl max-w-sm backdrop-blur">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-2.5">Legenda Visual</span>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-850 border border-slate-700" />
                <span>Dente Saudável</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span>Cárie / Fratura</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                <span>Implante Planejado</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>Coroa / Prótese</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lado Direito - Cartão Consolidado do Paciente */}
        <div className="flex flex-col gap-5 bg-slate-900 border border-slate-800 p-6 rounded-3xl min-h-0 overflow-y-auto">
          <div>
            <h3 className="text-sm font-bold uppercase text-slate-400 tracking-wider">Resumo do Plano</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Consolidação financeira dos tratamentos para aceite formal.
            </p>
          </div>

          <div className="border-t border-slate-800 pt-4 mt-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Investimento Total</span>
            <p className="text-2xl font-bold text-sky-400 mt-1">
              R$ {getPlanTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Lista Simplificada de Procedimentos */}
          <div className="flex-1 flex flex-col gap-2 min-h-[150px]">
            <span className="text-[10px] text-slate-400 font-bold uppercase mb-1">Procedimentos Planejados:</span>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[180px]">
              {procedures.length > 0 ? (
                procedures.map((p) => (
                  <div key={p.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex flex-col min-w-0 pr-1">
                      <span className="text-[9px] text-sky-400 font-bold uppercase">{getToothNumberForProcedure(p.tooth_id)}</span>
                      <span className="truncate text-slate-200 font-semibold mt-0.5">{p.procedure}</span>
                    </div>
                    <span className="text-sky-400 font-bold shrink-0">R$ {p.price.toFixed(0)}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs italic">
                  Nenhum procedimento planejado.
                </div>
              )}
            </div>
          </div>

          {/* Estado de Aceite do Paciente */}
          <div className="border-t border-slate-800 pt-4 mt-auto">
            {isAccepted ? (
              <div className="bg-emerald-950/40 border border-emerald-800/80 p-4 rounded-2xl flex flex-col items-center gap-3 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-400">Tratamento Aprovado!</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Assinatura digital capturada e salva com sucesso.</p>
                </div>
                {signatureData && (
                  <img src={signatureData} alt="Assinatura digital do paciente" className="h-10 border border-slate-800 bg-white rounded p-1 invert opacity-80" />
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowSignatureModal(true)}
                className="w-full py-3.5 bg-sky-600 border border-sky-500 hover:bg-sky-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
              >
                <ShieldCheck className="w-4.5 h-4.5" />
                <span>Aprovar Tratamento</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Modal de Assinatura Digital */}
      {showSignatureModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <SignatureCanvas
            onSave={handleSaveSignature}
            onCancel={() => setShowSignatureModal(false)}
          />
        </div>
      )}
    </div>
  );
}
