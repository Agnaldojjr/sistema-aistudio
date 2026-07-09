import React, { useState } from 'react';
import { usePlanning3D } from '../hooks/usePlanning3D';
import { SignatureCanvas } from './SignatureCanvas';
import { DentalScene } from '../DentalViewer/DentalScene';
import { usePatientContext } from '../../context/PatientContext';
import { Monitor, ShieldCheck, CheckCircle2, X, Eye, EyeOff } from 'lucide-react';

// Helper inlined
const getToothNumberForProcedure = (id: string) => {
  const parts = id.split('-');
  return parts.length >= 2 ? parts[1] : 'Geral';
};

export function PresentationPanel3D() {
  const { viewerState, teeth, procedures, getPlanTotal, setSimulationState, setPresentationMode, acceptPlan, planStatus, signatureData } = usePlanning3D();
  const { activeProposal } = usePatientContext();

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showBudgetPanel, setShowBudgetPanel] = useState(false);

  const handleSaveSignature = (base64: string) => {
    acceptPlan(base64);
    setShowSignatureModal(false);
  };

  const isAccepted = planStatus === 'ACCEPTED';

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950 text-slate-200 flex flex-col p-6 animate-in slide-in-from-bottom-10 fade-in duration-500 overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                Plano de Tratamento de {activeProposal?.patientName || 'Paciente'}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowBudgetPanel(!showBudgetPanel)}
              className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-sky-400 text-xs font-bold rounded-xl flex items-center gap-2 transition-all"
            >
              {showBudgetPanel ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showBudgetPanel ? 'Ocultar Orçamento' : 'Mostrar Orçamento'}
            </button>
            <button
              onClick={() => window.close()}
              className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-all"
            >
              Sair da Apresentação
            </button>
          </div>
        </div>

        {/* Grid Central */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6 min-h-0">
          
          {/* Lado Esquerdo - Visualizador Clínico Simplificado com o DentalCanvas3D ativo */}
          <div className={`${showBudgetPanel ? 'lg:col-span-3' : 'lg:col-span-4'} bg-slate-900/40 border border-slate-900 rounded-3xl p-4 flex flex-col gap-4 relative min-h-[400px] transition-all duration-300`}>
            {/* Alternadores de Simulação Antes/Depois */}
            <div className="absolute top-6 left-6 z-10 flex gap-2">
              <button
                onClick={() => setSimulationState('BEFORE')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  viewerState.simulationState === 'BEFORE'
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                }`}
              >
                Condição Atual
              </button>
              <button
                onClick={() => setSimulationState('AFTER')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  viewerState.simulationState === 'AFTER'
                    ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                }`}
              >
                Resultado Esperado
              </button>
            </div>

            {/* Viewport do 3D - Reusa o DentalScene que já renderiza os dentes */}
            <div className="flex-1 rounded-2xl overflow-hidden bg-slate-950 relative border border-slate-800">
              <DentalScene isPresentationMode={true} />
            </div>

            {/* Legenda Opcional na base */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-md px-6 py-3 rounded-full border border-slate-800 shadow-2xl flex gap-6">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span className="text-xs font-medium">Condição / Cárie</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                <span className="text-xs font-medium">Restauração Planejada</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-xs font-medium">Coroa / Prótese</span>
              </div>
            </div>
          </div>

          {/* Lado Direito - Cartão Consolidado do Paciente */}
          {showBudgetPanel && (
            <div className="flex flex-col gap-5 bg-slate-900 border border-slate-800 p-6 rounded-3xl min-h-0 overflow-y-auto animate-fade-in">
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
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[180px] scrollbar-thin">
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
          )}
        </div>

        {/* Modal de Assinatura */}
        {showSignatureModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-sky-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-200">Assinatura do Plano</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Assine no espaço abaixo para confirmar o tratamento.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSignatureModal(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                <SignatureCanvas
                  onSave={handleSaveSignature}
                  onCancel={() => setShowSignatureModal(false)}
                />
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
