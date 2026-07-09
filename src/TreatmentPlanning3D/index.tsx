import React, { useState } from 'react';
import { Planning3DProvider } from './context/Planning3DContext';
import { DentalScene } from './DentalViewer/DentalScene';
import { ToothDetailPanel } from './components/ToothDetailPanel';
import { BudgetPanel3D } from './components/BudgetPanel3D';
import { PresentationPanel3D } from './components/PresentationPanel3D';
import { AIAssistancePanel } from './components/AIAssistancePanel';
import { usePlanning3D } from './hooks/usePlanning3D';
import { usePatientContext } from '../context/PatientContext';
import { Layers, FileText, Coins, CheckCircle, ChevronRight, Monitor, UserX } from 'lucide-react';

function TreatmentPlanning3DContent() {
  const { viewerState, selectTooth, teeth, procedures, getPlanTotal, setPresentationMode } = usePlanning3D();
  const { selectedPatient } = usePatientContext();
  const [activeTab, setActiveTab] = useState<'clinical' | 'financial' | 'ai'>('clinical');

  if (!selectedPatient) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-950 text-white min-h-[calc(100vh-140px)] rounded-3xl border border-slate-800 text-center gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-full text-slate-500">
          <UserX size={40} />
        </div>
        <div className="max-w-md">
          <h2 className="text-lg font-bold text-white mb-2">Nenhum Paciente Selecionado</h2>
          <p className="text-sm text-slate-400">
            Selecione um paciente no painel de pacientes do CRM para iniciar o planejamento clínico e financeiro 3D.
          </p>
        </div>
      </div>
    );
  }

  // Filtra dentes que possuem alguma patologia/condição não saudável ou procedimentos
  const diagnosedTeeth = Object.values(teeth).filter(
    (t) => t.condition !== 'HEALTHY' || procedures.some((p) => p.tooth_id === t.id)
  );

  // Se estiver em modo de apresentação, renderiza a visualização do paciente em tela cheia
  if (viewerState.presentationMode) {
    return <PresentationPanel3D />;
  }

  return (
    <div className="relative flex flex-col gap-6 p-6 bg-slate-950 text-white min-h-[calc(100vh-140px)] rounded-3xl border border-slate-800 overflow-hidden">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-sky-400 font-bold uppercase tracking-wider text-xs">
            <Layers className="w-4 h-4" />
            <span>Módulo Clínico</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Treatment Planning 3D
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Visualizador Anatômico Interativo de Alta Performance para Odontologia
          </p>
        </div>

        {/* Acionador do Modo Apresentação */}
        <button
          onClick={() => setPresentationMode(true)}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg transition-all"
        >
          <Monitor className="w-4 h-4" />
          <span>Apresentar ao Paciente</span>
        </button>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Canvas 3D */}
        <div className="xl:col-span-2">
          <DentalScene />
        </div>

        {/* Resumo Geral Consolidado (Sem dente selecionado) */}
        <div className="flex flex-col gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          {/* Navegação de Abas do Painel Geral */}
          <div className="flex border-b border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab('clinical')}
              className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider text-center transition-all ${
                activeTab === 'clinical' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Plano
            </button>
            <button
              onClick={() => setActiveTab('financial')}
              className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider text-center transition-all ${
                activeTab === 'financial' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Orçamento
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider text-center transition-all ${
                activeTab === 'ai' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              IA
            </button>
          </div>

          {activeTab === 'clinical' && (
            <>
               {/* Cabeçalho do Paciente Ativo */}
              <div className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-sky-950 flex items-center justify-center text-xs font-bold text-sky-400 border border-sky-800">
                  {selectedPatient.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-bold text-white leading-tight">{selectedPatient.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-none">CPF: {selectedPatient.cpf || 'Não informado'}</p>
                </div>
              </div>

              {/* Totalizador Financeiro */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Total Estimado</p>
                  <p className="text-lg font-bold text-sky-400 mt-0.5">R$ {getPlanTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="p-2 bg-sky-950/50 rounded-lg border border-sky-900">
                  <Coins className="w-5 h-5 text-sky-400" />
                </div>
              </div>

              {/* Dentes Mapeados no Plano */}
              <div className="flex-1 flex flex-col gap-3 min-h-[220px]">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Resumo Clínico por Dente:</p>
                
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[280px]">
                  {diagnosedTeeth.length > 0 ? (
                    diagnosedTeeth.map((t) => {
                      const toothProcs = procedures.filter((p) => p.tooth_id === t.id);
                      return (
                        <div
                          key={t.id}
                          onClick={() => selectTooth(t.tooth)}
                          className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl hover:border-sky-500/50 cursor-pointer transition-all flex items-start justify-between group"
                        >
                          <div>
                            <p className="text-xs font-bold text-sky-400">Dente {t.tooth}</p>
                            <p className="text-[9px] text-slate-400 font-semibold mt-0.5">
                              Condição: <span className="text-slate-300 font-bold">{t.condition}</span>
                            </p>
                            {toothProcs.length > 0 && (
                              <p className="text-[9px] text-slate-500 font-semibold mt-1">
                                {toothProcs.length} procedimento(s) planejado(s)
                              </p>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-sky-400 transition-colors self-center" />
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-500 text-center">
                      <CheckCircle className="w-7 h-7 text-slate-600 mb-2 opacity-50" />
                      <p className="text-xs italic">Nenhum diagnóstico ou tratamento registrado ainda.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'financial' && (
            <div className="flex-1 flex flex-col min-h-[280px]">
              <BudgetPanel3D />
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="flex-1 flex flex-col min-h-[280px]">
              <AIAssistancePanel />
            </div>
          )}
        </div>
      </div>

      {/* A Gaveta Lateral Deslizante (Drawer) continua abrindo sem bloquear a tela toda */}

      <div
        className={`fixed top-[60px] right-0 bottom-0 z-50 w-85 bg-slate-950 border-l border-slate-800 p-5 shadow-2xl transition-transform duration-300 ease-out transform ${
          viewerState.activeTooth !== null ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <ToothDetailPanel onClose={() => selectTooth(null)} />
      </div>
    </div>
  );
}

export default function TreatmentPlanning3D({ procedures, onOpenProcedureManager }: { procedures: any[], onOpenProcedureManager?: () => void }) {
  return (
    <Planning3DProvider globalProcedures={procedures} onOpenProcedureManager={onOpenProcedureManager}>
      <TreatmentPlanning3DContent />
    </Planning3DProvider>
  );
}
