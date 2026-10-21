import React, { useState } from 'react';
import {
  Layers,
  CheckCircle2,
  Plus,
  Trash2,
  RefreshCw,
  Sliders,
  Sparkles,
  Check,
  X,
  RotateCcw,
} from 'lucide-react';
import {
  PhotoSection,
  Procedure,
  ClinicalStage,
  ClinicalStageId,
  ToothMarker,
} from '../types';
import {
  DEFAULT_CLINICAL_STAGES,
  getDefaultStageForProcedure,
  getDefaultToothCoordinates,
} from '../constants';
import {
  AcquirerId,
  AcquirerRateTable,
  SalesVolumeTier,
  CardBrandId,
  resetAcquirerRatesToDefault,
  saveAcquirerRates,
} from '../lib/cardMachineRates';

export interface ResolvedBudgetProcedureItem {
  sectionId: string;
  markerId: string;
  toothNumber: number;
  procedureId: string;
  procedureName: string;
  price: number;
  stageId: ClinicalStageId;
  stageEnabled: boolean;
  itemIncluded: boolean;
  effectiveIncluded: boolean;
}

interface BudgetStagesAutonomyPanelProps {
  sections: PhotoSection[];
  onUpdateSections: (sections: PhotoSection[]) => void;
  procedures: Procedure[];
  stages: ClinicalStage[];
  onUpdateStages: (stages: ClinicalStage[]) => void;
  resolvedItems: ResolvedBudgetProcedureItem[];
  activeTotal: number;
  deferredTotal: number;
  onResetCustomNet?: () => void;
  // Acquirer props
  selectedAcquirer: AcquirerId;
  onSelectAcquirer: (acq: AcquirerId) => void;
  acquirerRates: Record<AcquirerId, AcquirerRateTable>;
  onUpdateAcquirerRates: (rates: Record<AcquirerId, AcquirerRateTable>) => void;
  salesVolume: SalesVolumeTier;
  cardBrand: CardBrandId;
  onSyncRatesWithAI: () => Promise<void>;
  isSyncingRates: boolean;
  syncRatesMessage: string;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export default function BudgetStagesAutonomyPanel({
  sections,
  onUpdateSections,
  procedures,
  stages,
  onUpdateStages,
  resolvedItems,
  activeTotal,
  deferredTotal,
  onResetCustomNet,
  selectedAcquirer,
  onSelectAcquirer,
  acquirerRates,
  onUpdateAcquirerRates,
  salesVolume,
  cardBrand,
  onSyncRatesWithAI,
  isSyncingRates,
  syncRatesMessage,
}: BudgetStagesAutonomyPanelProps) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickTooth, setQuickTooth] = useState<string>('11');
  const [quickProcId, setQuickProcId] = useState<string>(procedures[0]?.id || '');
  const [quickStageId, setQuickStageId] = useState<ClinicalStageId>('stage_1');
  const [quickCustomPrice, setQuickCustomPrice] = useState<string>('');

  const [showRatesEditor, setShowRatesEditor] = useState(false);

  // Toggle an entire stage on/off
  const handleToggleStage = (stageId: ClinicalStageId) => {
    const next = stages.map((st) =>
      st.id === stageId ? { ...st, enabled: !st.enabled } : st
    );
    onUpdateStages(next);
    if (onResetCustomNet) onResetCustomNet();
  };

  // Preset stage combinations
  const handleApplyStagePreset = (enabledIds: ClinicalStageId[]) => {
    const next = stages.map((st) => ({
      ...st,
      enabled: enabledIds.includes(st.id),
    }));
    onUpdateStages(next);
    if (onResetCustomNet) onResetCustomNet();
  };

  // Toggle individual procedure inclusion
  const handleToggleItemIncluded = (item: ResolvedBudgetProcedureItem) => {
    const nextSections = (sections || []).map((sec) => {
      if (sec.id !== item.sectionId) return sec;
      return {
        ...sec,
        markers: (sec.markers || []).map((m) => {
          if (m.id !== item.markerId) return m;
          const excluded = new Set(m.excludedProcedures || []);
          const nextIncluded = !item.itemIncluded;
          if (nextIncluded) {
            excluded.delete(item.procedureId);
          } else {
            excluded.add(item.procedureId);
          }
          const updatedInstances = m.procedureInstances?.map((inst) =>
            inst.procedureId === item.procedureId
              ? { ...inst, includeFinancial: nextIncluded }
              : inst
          );
          return {
            ...m,
            excludedProcedures: Array.from(excluded),
            procedureInstances: updatedInstances,
          };
        }),
      };
    });
    onUpdateSections(nextSections);
    if (onResetCustomNet) onResetCustomNet();
  };

  // Move procedure to another clinical stage
  const handleChangeItemStage = (
    item: ResolvedBudgetProcedureItem,
    newStageId: ClinicalStageId
  ) => {
    const nextSections = (sections || []).map((sec) => {
      if (sec.id !== item.sectionId) return sec;
      return {
        ...sec,
        markers: (sec.markers || []).map((m) => {
          if (m.id !== item.markerId) return m;
          return {
            ...m,
            procedureStages: {
              ...(m.procedureStages || {}),
              [item.procedureId]: newStageId,
            },
            procedureInstances: m.procedureInstances?.map((inst) =>
              inst.procedureId === item.procedureId
                ? { ...inst, stageId: newStageId }
                : inst
            ),
          };
        }),
      };
    });
    onUpdateSections(nextSections);
    if (onResetCustomNet) onResetCustomNet();
  };

  // Edit price of an individual procedure on a tooth
  const handleChangeItemPrice = (
    item: ResolvedBudgetProcedureItem,
    newPrice: number
  ) => {
    const validPrice = Number.isFinite(newPrice) && newPrice >= 0 ? newPrice : 0;
    const nextSections = (sections || []).map((sec) => {
      if (sec.id !== item.sectionId) return sec;
      return {
        ...sec,
        markers: (sec.markers || []).map((m) => {
          if (m.id !== item.markerId) return m;
          return {
            ...m,
            customPrices: {
              ...(m.customPrices || {}),
              [item.procedureId]: validPrice,
            },
            procedureInstances: m.procedureInstances?.map((inst) =>
              inst.procedureId === item.procedureId
                ? { ...inst, price: validPrice }
                : inst
            ),
          };
        }),
      };
    });
    onUpdateSections(nextSections);
    if (onResetCustomNet) onResetCustomNet();
  };

  // Remove a procedure from a tooth
  const handleRemoveItem = (item: ResolvedBudgetProcedureItem) => {
    const nextSections = (sections || []).map((sec) => {
      if (sec.id !== item.sectionId) return sec;
      return {
        ...sec,
        markers: (sec.markers || [])
          .map((m) => {
            if (m.id !== item.markerId) return m;
            return {
              ...m,
              procedures: (m.procedures || []).filter((id) => id !== item.procedureId),
              procedureInstances: m.procedureInstances?.filter(
                (inst) => inst.procedureId !== item.procedureId
              ),
            };
          })
          .filter((m) => (m.procedures && m.procedures.length > 0) || m.notes),
      };
    });
    onUpdateSections(nextSections);
    if (onResetCustomNet) onResetCustomNet();
  };

  // Quick add a procedure directly inside the Budget tab
  const handleQuickAddProcedure = () => {
    const proc = procedures.find((p) => p.id === quickProcId);
    if (!proc) return;
    const tNum = parseInt(quickTooth, 10) || 0;
    const targetSecId =
      tNum >= 11 && tNum <= 28 ? 'upper' : tNum >= 31 && tNum <= 48 ? 'lower' : 'panoramic';
    const customPriceVal =
      quickCustomPrice.trim() !== '' ? parseFloat(quickCustomPrice) : proc.price;

    const nextSections = [...(sections || [])];
    let secIdx = nextSections.findIndex((s) => s.id === targetSecId);
    if (secIdx === -1) {
      nextSections.push({
        id: targetSecId,
        title:
          targetSecId === 'upper'
            ? 'Arcada Superior'
            : targetSecId === 'lower'
            ? 'Arcada Inferior'
            : 'Geral / Panorâmica',
        subtitle: 'Orçamento',
        image: null,
        markers: [],
      });
      secIdx = nextSections.length - 1;
    }

    const coords = getDefaultToothCoordinates(tNum, targetSecId);
    const newMarker: ToothMarker = {
      id: `${targetSecId}-${tNum}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      toothNumber: tNum,
      x: coords.x,
      y: coords.y,
      procedures: [proc.id],
      procedureStages: { [proc.id]: quickStageId },
      customPrices: { [proc.id]: Number.isFinite(customPriceVal) ? customPriceVal : proc.price },
    };

    nextSections[secIdx] = {
      ...nextSections[secIdx],
      markers: [...(nextSections[secIdx].markers || []), newMarker],
    };

    onUpdateSections(nextSections);
    if (onResetCustomNet) onResetCustomNet();
    setQuickCustomPrice('');
    setShowQuickAdd(false);
  };

  const currentAcqTable = acquirerRates[selectedAcquirer];
  const currentTierRates = currentAcqTable.tiers[salesVolume];

  return (
    <div className="space-y-6 print:hidden">
      {/* 1. PAINEL DE AUTONOMIA POR ETAPAS CLÍNICAS */}
      <div className="bg-white border-2 border-[#C09553]/50 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#8B0000] text-white">
                Autonomia na Consulta
              </span>
              <span className="text-xs text-zinc-500 font-medium">
                Divida o orçamento por etapas na frente do paciente sem criar novas versões
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-serif font-bold text-[#8B0000] flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#C09553]" />
              Divisão Inteligente por Etapas Clínicas (Urgência → Função → Estética)
            </h3>
          </div>

          {/* Atalhos de Cenário com 1 Clique */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                handleApplyStagePreset(
                  (stages.length ? stages : DEFAULT_CLINICAL_STAGES).map((s) => s.id)
                )
              }
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-zinc-200 bg-[#FAF8F5] hover:border-[#8B0000] text-zinc-800 transition-all cursor-pointer"
            >
              ✅ Plano Completo
            </button>
            <button
              type="button"
              onClick={() => handleApplyStagePreset(['stage_1'])}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-red-200 bg-red-50/70 hover:bg-red-100 text-red-900 transition-all cursor-pointer"
            >
              🚨 Só Fase 1 (Urgência)
            </button>
            <button
              type="button"
              onClick={() => handleApplyStagePreset(['stage_1', 'stage_2'])}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-amber-200 bg-amber-50/80 hover:bg-amber-100 text-amber-900 transition-all cursor-pointer"
            >
              🦷 Fase 1 + Fase 2 (Sem Estética)
            </button>
            <button
              type="button"
              onClick={() => setShowQuickAdd((v) => !v)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#8B0000] hover:bg-[#6e0000] text-white shadow-xs flex items-center gap-1 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Procedimento Rápido</span>
            </button>
          </div>
        </div>

        {/* Formulário de Adição Rápida de Procedimento direto no Orçamento */}
        {showQuickAdd && (
          <div className="bg-[#FAF8F5] border border-[#D5CBB3] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#8B0000] uppercase">
                Adicionar Procedimento Direto no Orçamento
              </span>
              <button
                type="button"
                onClick={() => setShowQuickAdd(false)}
                className="text-zinc-400 hover:text-red-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">
                  Dente (ou 0 p/ Geral)
                </label>
                <input
                  type="number"
                  value={quickTooth}
                  onChange={(e) => setQuickTooth(e.target.value)}
                  placeholder="Ex: 11, 24 ou 0"
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">
                  Procedimento
                </label>
                <select
                  value={quickProcId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setQuickProcId(pid);
                    const p = procedures.find((pr) => pr.id === pid);
                    if (p) {
                      setQuickStageId(
                        p.defaultStageId || getDefaultStageForProcedure(p.name, p.id)
                      );
                    }
                  }}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-2 text-xs font-semibold"
                >
                  {procedures.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatCurrency(p.price)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">
                  Etapa Clínica
                </label>
                <select
                  value={quickStageId}
                  onChange={(e) => setQuickStageId(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-2 text-xs font-semibold"
                >
                  {stages.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">
                    Valor Especial (Opcional)
                  </label>
                  <input
                    type="number"
                    value={quickCustomPrice}
                    onChange={(e) => setQuickCustomPrice(e.target.value)}
                    placeholder="Padrão"
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleQuickAddProcedure}
                  className="px-4 py-2 bg-[#8B0000] text-white rounded-lg text-xs font-bold cursor-pointer shrink-0"
                >
                  Incluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cards das 3 Etapas com Checkboxes e Subtotais */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {stages.map((stage) => {
            const stageItems = resolvedItems.filter((i) => i.stageId === stage.id);
            const stageActiveSum = stageItems
              .filter((i) => i.itemIncluded)
              .reduce((acc, i) => acc + i.price, 0);

            return (
              <div
                key={stage.id}
                className={`rounded-2xl border-2 p-4 transition-all flex flex-col justify-between space-y-3 ${
                  stage.enabled
                    ? 'border-[#C09553] bg-[#FAF8F5] shadow-xs'
                    : 'border-zinc-200 bg-zinc-50/70 opacity-75'
                }`}
              >
                <div className="space-y-2.5">
                  {/* Cabeçalho da Etapa com Switch */}
                  <div className="flex items-start justify-between gap-2">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none flex-1">
                      <input
                        type="checkbox"
                        checked={stage.enabled}
                        onChange={() => handleToggleStage(stage.id)}
                        className="mt-0.5 w-4 h-4 rounded accent-[#8B0000] cursor-pointer"
                      />
                      <div>
                        <span
                          className="inline-block text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded text-white"
                          style={{ backgroundColor: stage.color }}
                        >
                          {stage.label}
                        </span>
                        <p className="text-[11px] text-zinc-500 mt-1 leading-snug">
                          {stage.subtitle}
                        </p>
                      </div>
                    </label>

                    <div className="text-right shrink-0">
                      <span
                        className={`font-mono font-extrabold text-sm block ${
                          stage.enabled ? 'text-[#8B0000]' : 'text-zinc-400 line-through'
                        }`}
                      >
                        {formatCurrency(stageActiveSum)}
                      </span>
                      <span className="text-[9.5px] font-bold uppercase text-zinc-400">
                        {stage.enabled ? 'Ativa Hoje' : 'P/ 2º Momento'}
                      </span>
                    </div>
                  </div>

                  {/* Lista de Procedimentos desta Etapa */}
                  {stageItems.length === 0 ? (
                    <div className="text-[11px] text-zinc-400 italic py-3 text-center bg-white/60 rounded-xl border border-dashed border-zinc-200">
                      Nenhum procedimento nesta etapa.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 pt-1">
                      {stageItems.map((item, idx) => (
                        <div
                          key={`${item.markerId}-${item.procedureId}-${idx}`}
                          className={`rounded-xl border px-2.5 py-2 flex items-center justify-between gap-2 text-xs transition-colors ${
                            item.effectiveIncluded
                              ? 'bg-white border-zinc-200'
                              : 'bg-zinc-100/70 border-zinc-200/60 text-zinc-400'
                          }`}
                        >
                          <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={item.itemIncluded}
                              onChange={() => handleToggleItemIncluded(item)}
                              className="w-3.5 h-3.5 rounded accent-[#8B0000] cursor-pointer shrink-0"
                            />
                            <span className="font-mono font-bold text-[#8B0000] text-[11px] shrink-0">
                              {item.toothNumber === 0 ? 'Geral' : `D${item.toothNumber}`}
                            </span>
                            <span
                              className={`font-medium truncate ${
                                !item.itemIncluded ? 'line-through text-zinc-400' : 'text-zinc-800'
                              }`}
                              title={item.procedureName}
                            >
                              {item.procedureName}
                            </span>
                          </label>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Preço editável inline */}
                            <div className="relative w-20">
                              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-zinc-400">
                                R$
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="10"
                                value={item.price}
                                onChange={(e) =>
                                  handleChangeItemPrice(
                                    item,
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-full bg-zinc-50 border border-zinc-200 rounded pl-5 pr-1 py-0.5 text-[11px] font-mono font-bold text-right text-zinc-800 focus:outline-none focus:border-[#8B0000]"
                                title="Editar valor deste procedimento neste orçamento"
                              />
                            </div>

                            {/* Mudar de Fase (F1/F2/F3) */}
                            <select
                              value={item.stageId}
                              onChange={(e) =>
                                handleChangeItemStage(item, e.target.value)
                              }
                              className="bg-zinc-50 border border-zinc-200 rounded px-1 py-0.5 text-[10px] font-bold text-zinc-600 cursor-pointer"
                              title="Mover procedimento para outra etapa"
                            >
                              <option value="stage_1">F1</option>
                              <option value="stage_2">F2</option>
                              <option value="stage_3">F3</option>
                            </select>

                            {/* Excluir item */}
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item)}
                              className="text-zinc-400 hover:text-red-600 p-0.5 cursor-pointer"
                              title="Remover procedimento do orçamento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-zinc-200/70 flex items-center justify-between text-[10.5px] font-semibold text-zinc-500">
                  <span>{stageItems.length} item(ns) na etapa</span>
                  <button
                    type="button"
                    onClick={() => handleToggleStage(stage.id)}
                    className={`font-bold underline cursor-pointer ${
                      stage.enabled ? 'text-zinc-500 hover:text-zinc-800' : 'text-[#8B0000]'
                    }`}
                  >
                    {stage.enabled ? 'Deixar para 2º momento' : 'Incluir no fechamento hoje'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Barra Resumo Financeiro das Etapas Ativas vs. Futuras */}
        <div className="bg-[#FAF8F5] border border-[#E6DEC9] rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                Total Ativo p/ Fechamento Agora
              </span>
              <strong className="text-lg font-mono font-extrabold text-emerald-800">
                {formatCurrency(activeTotal)}
              </strong>
            </div>

            {deferredTotal > 0 && (
              <div className="border-l border-[#D5CBB3] pl-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                  Etapas Futuras (Planejadas p/ Depois)
                </span>
                <strong className="text-sm font-mono font-bold text-amber-800">
                  {formatCurrency(deferredTotal)}
                </strong>
              </div>
            )}
          </div>

          <p className="text-[11px] text-zinc-500 max-w-md">
            💡 Desmarque etapas ou procedimentos acima para adequar a parcela exatamente ao bolso do paciente em segundos.
          </p>
        </div>
      </div>

      {/* 2. BARRA DE MAQUININHA DUPLA (TON + INFINITETAP) & SINCRONIZAÇÃO IA */}
      <div className="bg-white border border-[#E6DEC9] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8B0000]">
              Maquininha Ativa:
            </span>
            <div className="inline-flex rounded-xl bg-[#FAF8F5] p-1 border border-[#D5CBB3]">
              <button
                type="button"
                onClick={() => onSelectAcquirer('ton')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedAcquirer === 'ton'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                🟢 Ton (Stone)
              </button>
              <button
                type="button"
                onClick={() => onSelectAcquirer('infinitetap')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedAcquirer === 'infinitetap'
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                ⚫ InfiniteTap (InfinitePay)
              </button>
            </div>

            <span className="text-[11px] text-zinc-500 font-medium">
              Fonte: <strong className="text-zinc-700">{currentAcqTable.source}</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSyncRatesWithAI}
              disabled={isSyncingRates}
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-[#8B0000] border border-[#C09553]/50 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Consulta as taxas vigentes de Ton e InfiniteTap com validação matemática contra erros"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingRates ? 'animate-spin' : ''}`} />
              <span>
                {isSyncingRates
                  ? 'Consultando Taxas...'
                  : `Atualizar Taxas ${currentAcqTable.name} (IA)`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowRatesEditor((v) => !v)}
              className="px-3 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-zinc-100 text-zinc-700 border border-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-[#C09553]" />
              <span>{showRatesEditor ? 'Ocultar Tabela' : 'Ver / Ajustar Taxas (%)'}</span>
            </button>
          </div>
        </div>

        {syncRatesMessage && (
          <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncRatesMessage}</span>
          </div>
        )}

        {/* Painel Expansível para Conferir ou Editar Manualmente qualquer Taxa */}
        {showRatesEditor && (
          <div className="bg-[#FAF8F5] border border-[#E6DEC9] rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6DEC9] pb-2">
              <div>
                <h5 className="text-xs font-bold text-[#8B0000] uppercase">
                  Tabela de Taxas — {currentAcqTable.name} ({cardBrand === 'visa_master' ? 'Visa / Mastercard' : 'Elo / Amex'})
                </h5>
                <p className="text-[11px] text-zinc-500">
                  Valores em porcentagem (%). Qualquer ajuste é validado automaticamente para evitar erros de cálculo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const defaults = resetAcquirerRatesToDefault();
                  onUpdateAcquirerRates(defaults);
                }}
                className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200 hover:border-red-300 text-zinc-600 hover:text-red-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restaurar Padrão Oficial</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
              {/* Débito */}
              <div className="bg-white border border-zinc-200 rounded-lg p-2">
                <label className="block text-[9.5px] font-bold text-zinc-500 uppercase">
                  Débito (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="14.9"
                  value={currentTierRates.debit[cardBrand]}
                  onChange={(e) => {
                    const val = Math.min(14.9, Math.max(0.1, parseFloat(e.target.value) || 0));
                    const next = {
                      ...acquirerRates,
                      [selectedAcquirer]: {
                        ...currentAcqTable,
                        source: 'Ajuste Manual do Consultório',
                        tiers: {
                          ...currentAcqTable.tiers,
                          [salesVolume]: {
                            ...currentTierRates,
                            debit: {
                              ...currentTierRates.debit,
                              [cardBrand]: val,
                            },
                          },
                        },
                      },
                    };
                    onUpdateAcquirerRates(next);
                    saveAcquirerRates(next);
                  }}
                  className="w-full mt-1 font-mono font-bold text-xs text-[#8B0000] bg-zinc-50 border border-zinc-200 rounded px-1.5 py-1"
                />
              </div>

              {/* 1x a 12x Crédito */}
              {currentTierRates.credit[cardBrand].map((rateVal, idx) => (
                <div key={idx} className="bg-white border border-zinc-200 rounded-lg p-2">
                  <label className="block text-[9.5px] font-bold text-zinc-500 uppercase">
                    Crédito {idx + 1}x (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.5"
                    max="40"
                    value={rateVal}
                    onChange={(e) => {
                      const val = Math.min(40, Math.max(0.5, parseFloat(e.target.value) || 0));
                      const nextCreditArr = [...currentTierRates.credit[cardBrand]];
                      nextCreditArr[idx] = val;
                      const next = {
                        ...acquirerRates,
                        [selectedAcquirer]: {
                          ...currentAcqTable,
                          source: 'Ajuste Manual do Consultório',
                          tiers: {
                            ...currentAcqTable.tiers,
                            [salesVolume]: {
                              ...currentTierRates,
                              credit: {
                                ...currentTierRates.credit,
                                [cardBrand]: nextCreditArr,
                              },
                            },
                          },
                        },
                      };
                      onUpdateAcquirerRates(next);
                      saveAcquirerRates(next);
                    }}
                    className="w-full mt-1 font-mono font-bold text-xs text-zinc-800 bg-zinc-50 border border-zinc-200 rounded px-1.5 py-1"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
