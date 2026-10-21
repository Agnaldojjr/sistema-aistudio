import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Check,
  Sparkles,
  Layers,
  Edit2,
  X,
  CheckSquare,
  Square,
  MousePointerClick,
  Paintbrush,
  FileText,
  ArrowRight,
  Stethoscope,
} from 'lucide-react';
import {
  PhotoSection,
  Procedure,
  ToothMarker,
  ClinicalStage,
  ClinicalStageId,
} from '../types';
import {
  DEFAULT_CLINICAL_STAGES,
  getDefaultStageForProcedure,
  getDefaultToothCoordinates,
} from '../constants';

interface ArchOdontogram2DProps {
  sections: PhotoSection[];
  onUpdateSections: (sections: PhotoSection[]) => void;
  procedures: Procedure[];
  stages?: ClinicalStage[];
  onUpdateStages?: (stages: ClinicalStage[]) => void;
  onAddProcedure?: (newProc: Procedure) => void;
  onEditProcedure?: (updatedProc: Procedure) => void;
  onDeleteProcedure?: (procId: string) => void;
  onGoToNegotiation?: () => void;
}

const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

function getToothCategory(tooth: number): 'molar' | 'premolar' | 'canine' | 'incisor' {
  const digit = tooth % 10;
  if (digit >= 6) return 'molar';
  if (digit >= 4) return 'premolar';
  if (digit === 3) return 'canine';
  return 'incisor';
}

function getTargetSectionIdForTooth(toothNumber: number): string {
  if (toothNumber >= 11 && toothNumber <= 28) return 'upper';
  if (toothNumber >= 31 && toothNumber <= 48) return 'lower';
  return 'panoramic';
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export default function ArchOdontogram2D({
  sections,
  onUpdateSections,
  procedures,
  stages = DEFAULT_CLINICAL_STAGES,
  onAddProcedure,
  onEditProcedure,
  onDeleteProcedure,
  onGoToNegotiation,
}: ArchOdontogram2DProps) {
  // Tooth selection state (0 = Boca Toda / Geral)
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([11]);
  const [multiSelectMode, setMultiSelectMode] = useState<boolean>(false);
  const [interactionMode, setInteractionMode] = useState<'select_tooth' | 'paint_procedure'>('select_tooth');
  const [activePaintProcedureId, setActivePaintProcedureId] = useState<string | null>(
    procedures[0]?.id || null
  );
  const [forcedStageId, setForcedStageId] = useState<ClinicalStageId | 'auto'>('auto');
  const [searchProcedure, setSearchProcedure] = useState('');

  // Custom new procedure inline state
  const [showNewProcForm, setShowNewProcForm] = useState(false);
  const [newProcName, setNewProcName] = useState('');
  const [newProcPrice, setNewProcPrice] = useState('');
  const [newProcStage, setNewProcStage] = useState<ClinicalStageId>('stage_2');

  // Edit existing procedure inline state
  const [editingProcId, setEditingProcId] = useState<string | null>(null);
  const [editProcName, setEditProcName] = useState('');
  const [editProcPrice, setEditProcPrice] = useState('');

  // Consolidate all markers by toothNumber across all sections
  const markersByTooth = useMemo(() => {
    const map = new Map<number, { sectionId: string; marker: ToothMarker }[]>();
    (sections || []).forEach((sec) => {
      (sec.markers || []).forEach((m) => {
        const t = m.toothNumber || 0;
        const list = map.get(t) || [];
        list.push({ sectionId: sec.id, marker: m });
        map.set(t, list);
      });
    });
    return map;
  }, [sections]);

  // Helper to toggle a procedure on one or more teeth
  const toggleProcedureOnTeeth = (toothNumbers: number[], procId: string, stageOverride?: ClinicalStageId) => {
    const proc = procedures.find((p) => p.id === procId);
    if (!proc || toothNumbers.length === 0) return;

    const resolvedStageId: ClinicalStageId =
      stageOverride ||
      (forcedStageId !== 'auto'
        ? forcedStageId
        : proc.defaultStageId || getDefaultStageForProcedure(proc.name, proc.id));

    // Check if ALL selected teeth already have this procedure -> if so, remove it; otherwise add to all
    const allHaveProc = toothNumbers.every((tNum) => {
      const entries = markersByTooth.get(tNum) || [];
      return entries.some((e) => e.marker.procedures.includes(procId));
    });

    const nextSections = [...(sections || [])];

    // Ensure 'upper', 'lower', 'panoramic' exist
    const ensureSection = (secId: string) => {
      let idx = nextSections.findIndex((s) => s.id === secId);
      if (idx === -1) {
        nextSections.push({
          id: secId,
          title: secId === 'upper' ? 'Arcada Superior' : secId === 'lower' ? 'Arcada Inferior' : 'Geral / Panorâmica',
          subtitle: 'Mapeamento em Arcada 2D',
          image: null,
          markers: [],
        });
        idx = nextSections.length - 1;
      }
      return idx;
    };

    toothNumbers.forEach((tNum) => {
      const targetSecId = getTargetSectionIdForTooth(tNum);
      const secIdx = ensureSection(targetSecId);
      const sec = { ...nextSections[secIdx], markers: [...(nextSections[secIdx].markers || [])] };

      // Check if marker for this tooth exists in ANY section
      let foundInAnySection = false;
      for (let sIdx = 0; sIdx < nextSections.length; sIdx++) {
        const s = nextSections[sIdx];
        const mIdx = (s.markers || []).findIndex((m) => (m.toothNumber || 0) === tNum);
        if (mIdx !== -1) {
          foundInAnySection = true;
          const existingMarker = { ...s.markers[mIdx] };
          const currentProcs = [...(existingMarker.procedures || [])];
          const nextStages = { ...(existingMarker.procedureStages || {}) };

          if (allHaveProc) {
            existingMarker.procedures = currentProcs.filter((id) => id !== procId);
            delete nextStages[procId];
            if (existingMarker.procedureInstances) {
              existingMarker.procedureInstances = existingMarker.procedureInstances.filter(
                (inst) => inst.procedureId !== procId
              );
            }
          } else if (!currentProcs.includes(procId)) {
            existingMarker.procedures = [...currentProcs, procId];
            nextStages[procId] = resolvedStageId;
          } else {
            nextStages[procId] = resolvedStageId;
          }
          existingMarker.procedureStages = nextStages;

          const updatedMarkers = [...s.markers];
          if (existingMarker.procedures.length === 0 && !existingMarker.notes) {
            updatedMarkers.splice(mIdx, 1);
          } else {
            updatedMarkers[mIdx] = existingMarker;
          }
          nextSections[sIdx] = { ...s, markers: updatedMarkers };
          break;
        }
      }

      if (!foundInAnySection && !allHaveProc) {
        const coords = getDefaultToothCoordinates(tNum, targetSecId);
        const newMarker: ToothMarker = {
          id: `${targetSecId}-${tNum}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          toothNumber: tNum,
          x: coords.x,
          y: coords.y,
          procedures: [procId],
          procedureStages: { [procId]: resolvedStageId },
        };
        sec.markers.push(newMarker);
        nextSections[secIdx] = sec;
      }
    });

    onUpdateSections(nextSections);
  };

  // Change stage of a specific tooth + procedure
  const handleChangeProcedureStage = (toothNumber: number, procId: string, newStageId: ClinicalStageId) => {
    const nextSections = (sections || []).map((sec) => ({
      ...sec,
      markers: (sec.markers || []).map((m) => {
        if ((m.toothNumber || 0) !== toothNumber || !m.procedures.includes(procId)) return m;
        return {
          ...m,
          procedureStages: {
            ...(m.procedureStages || {}),
            [procId]: newStageId,
          },
          procedureInstances: m.procedureInstances?.map((inst) =>
            inst.procedureId === procId ? { ...inst, stageId: newStageId } : inst
          ),
        };
      }),
    }));
    onUpdateSections(nextSections);
  };

  // Update notes for the primary selected tooth
  const primaryTooth = selectedTeeth[0] ?? 11;
  const primaryToothNote = useMemo(() => {
    const entries = markersByTooth.get(primaryTooth) || [];
    return entries.find((e) => e.marker.notes)?.marker.notes || '';
  }, [markersByTooth, primaryTooth]);

  const handleUpdateToothNote = (toothNumber: number, noteText: string) => {
    const nextSections = [...(sections || [])];
    let updated = false;

    for (let sIdx = 0; sIdx < nextSections.length; sIdx++) {
      const s = nextSections[sIdx];
      const mIdx = (s.markers || []).findIndex((m) => (m.toothNumber || 0) === toothNumber);
      if (mIdx !== -1) {
        const updatedMarkers = [...s.markers];
        updatedMarkers[mIdx] = { ...updatedMarkers[mIdx], notes: noteText };
        nextSections[sIdx] = { ...s, markers: updatedMarkers };
        updated = true;
        break;
      }
    }

    if (!updated && noteText.trim()) {
      const targetSecId = getTargetSectionIdForTooth(toothNumber);
      let sIdx = nextSections.findIndex((s) => s.id === targetSecId);
      if (sIdx === -1) {
        nextSections.push({
          id: targetSecId,
          title: targetSecId === 'upper' ? 'Arcada Superior' : 'Arcada Inferior',
          subtitle: 'Mapeamento 2D',
          image: null,
          markers: [],
        });
        sIdx = nextSections.length - 1;
      }
      const coords = getDefaultToothCoordinates(toothNumber, targetSecId);
      nextSections[sIdx] = {
        ...nextSections[sIdx],
        markers: [
          ...(nextSections[sIdx].markers || []),
          {
            id: `${targetSecId}-${toothNumber}-${Date.now()}`,
            toothNumber,
            x: coords.x,
            y: coords.y,
            procedures: [],
            notes: noteText,
          },
        ],
      };
    }

    onUpdateSections(nextSections);
  };

  // Handle tooth click
  const handleToothClick = (toothNumber: number) => {
    if (interactionMode === 'paint_procedure' && activePaintProcedureId) {
      toggleProcedureOnTeeth([toothNumber], activePaintProcedureId);
      setSelectedTeeth([toothNumber]);
      return;
    }

    if (multiSelectMode) {
      setSelectedTeeth((prev) =>
        prev.includes(toothNumber)
          ? prev.length > 1
            ? prev.filter((t) => t !== toothNumber)
            : prev
          : [...prev, toothNumber]
      );
    } else {
      setSelectedTeeth([toothNumber]);
    }
  };

  // Flat list of all mapped items with their stage & price
  const allMappedItems = useMemo(() => {
    const items: Array<{
      sectionId: string;
      markerId: string;
      toothNumber: number;
      procedureId: string;
      procedureName: string;
      color: string;
      price: number;
      stageId: ClinicalStageId;
    }> = [];

    (sections || []).forEach((sec) => {
      (sec.markers || []).forEach((m) => {
        (m.procedures || []).forEach((pid) => {
          const proc = procedures.find((p) => p.id === pid);
          if (!proc) return;
          const inst = m.procedureInstances?.find((i) => i.procedureId === pid);
          const customPrice = m.customPrices?.[pid] ?? inst?.price ?? proc.price;
          const stageId =
            m.procedureStages?.[pid] ||
            inst?.stageId ||
            proc.defaultStageId ||
            getDefaultStageForProcedure(proc.name, proc.id);

          items.push({
            sectionId: sec.id,
            markerId: m.id,
            toothNumber: m.toothNumber || 0,
            procedureId: pid,
            procedureName: proc.name,
            color: proc.color,
            price: customPrice,
            stageId,
          });
        });
      });
    });

    return items;
  }, [sections, procedures]);

  const stageTotals = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    stages.forEach((st) => {
      map[st.id] = { count: 0, total: 0 };
    });
    allMappedItems.forEach((item) => {
      if (!map[item.stageId]) {
        map[item.stageId] = { count: 0, total: 0 };
      }
      map[item.stageId].count += 1;
      map[item.stageId].total += item.price;
    });
    return map;
  }, [allMappedItems, stages]);

  const grandTotal = useMemo(
    () => allMappedItems.reduce((acc, i) => acc + i.price, 0),
    [allMappedItems]
  );

  const filteredProcedures = useMemo(() => {
    const q = searchProcedure.trim().toLowerCase();
    if (!q) return procedures;
    return procedures.filter((p) => p.name.toLowerCase().includes(q));
  }, [procedures, searchProcedure]);

  // Render a single anatomical 2D tooth button
  const renderToothButton = (tooth: number, isUpper: boolean) => {
    const isSelected = selectedTeeth.includes(tooth);
    const entries = markersByTooth.get(tooth) || [];
    const mappedProcs: Array<{ proc: Procedure; stageId: ClinicalStageId }> = [];

    entries.forEach(({ marker }) => {
      (marker.procedures || []).forEach((pid) => {
        const proc = procedures.find((p) => p.id === pid);
        if (proc) {
          const stId =
            marker.procedureStages?.[pid] ||
            proc.defaultStageId ||
            getDefaultStageForProcedure(proc.name, proc.id);
          mappedProcs.push({ proc, stageId: stId });
        }
      });
    });

    const hasProcedures = mappedProcs.length > 0;
    const category = getToothCategory(tooth);
    const primaryStage = mappedProcs[0]
      ? stages.find((s) => s.id === mappedProcs[0].stageId)
      : null;

    // SVG Crown shape based on tooth anatomy
    const renderCrownSvg = () => {
      const strokeColor = hasProcedures
        ? primaryStage?.color || mappedProcs[0].proc.color || '#8B0000'
        : isSelected
        ? '#8B0000'
        : '#a1a1aa';
      const fillColor = hasProcedures
        ? `${primaryStage?.color || '#8B0000'}18`
        : isSelected
        ? '#FAF8F5'
        : '#ffffff';

      if (category === 'molar') {
        return (
          <svg viewBox="0 0 44 52" className="w-8 h-10 sm:w-9 sm:h-11 transition-transform">
            {/* Roots */}
            {isUpper ? (
              <path
                d="M10 22 L8 6 Q13 2 16 14 M22 20 L22 4 Q25 4 25 20 M34 22 L36 6 Q31 2 28 14"
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M12 30 L10 46 Q16 49 19 34 M32 30 L34 46 Q28 49 25 34"
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            )}
            {/* Molar Crown */}
            <rect
              x="6"
              y={isUpper ? '18' : '8'}
              width="32"
              height="24"
              rx="8"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={hasProcedures || isSelected ? '2.6' : '1.8'}
            />
            {/* Occlusal grooves */}
            <path
              d={isUpper ? 'M14 30 H30 M22 23 V37' : 'M14 20 H30 M22 13 V27'}
              stroke={strokeColor}
              strokeWidth="1.2"
              opacity="0.45"
              strokeLinecap="round"
            />
          </svg>
        );
      }

      if (category === 'premolar') {
        return (
          <svg viewBox="0 0 38 52" className="w-7 h-10 sm:w-8 sm:h-11 transition-transform">
            {isUpper ? (
              <path
                d="M15 22 L14 5 Q19 2 21 15 M23 22 L25 6"
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M19 30 L19 47"
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            )}
            <rect
              x="6"
              y={isUpper ? '19' : '9'}
              width="26"
              height="22"
              rx="9"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={hasProcedures || isSelected ? '2.6' : '1.8'}
            />
            <path
              d={isUpper ? 'M13 30 H25' : 'M13 20 H25'}
              stroke={strokeColor}
              strokeWidth="1.2"
              opacity="0.45"
              strokeLinecap="round"
            />
          </svg>
        );
      }

      if (category === 'canine') {
        return (
          <svg viewBox="0 0 34 52" className="w-6 h-10 sm:w-7 sm:h-11 transition-transform">
            {isUpper ? (
              <path d="M17 20 L17 3" stroke={strokeColor} strokeWidth="2.8" strokeLinecap="round" />
            ) : (
              <path d="M17 32 L17 49" stroke={strokeColor} strokeWidth="2.8" strokeLinecap="round" />
            )}
            <path
              d={
                isUpper
                  ? 'M6 22 Q6 17 17 17 Q28 17 28 22 L25 36 Q17 43 9 36 Z'
                  : 'M9 16 Q17 9 25 16 L28 30 Q28 35 17 35 Q6 35 6 30 Z'
              }
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={hasProcedures || isSelected ? '2.6' : '1.8'}
            />
          </svg>
        );
      }

      // Incisor
      return (
        <svg viewBox="0 0 34 52" className="w-6 h-10 sm:w-7 sm:h-11 transition-transform">
          {isUpper ? (
            <path d="M17 20 L17 5" stroke={strokeColor} strokeWidth="2.6" strokeLinecap="round" />
          ) : (
            <path d="M17 32 L17 47" stroke={strokeColor} strokeWidth="2.4" strokeLinecap="round" />
          )}
          <rect
            x="6"
            y={isUpper ? '18' : '11'}
            width="22"
            height="23"
            rx="5"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={hasProcedures || isSelected ? '2.6' : '1.8'}
          />
        </svg>
      );
    };

    return (
      <button
        key={tooth}
        type="button"
        onClick={() => handleToothClick(tooth)}
        title={
          mappedProcs.length > 0
            ? `Dente ${tooth}: ${mappedProcs.map((m) => m.proc.name).join(', ')}`
            : `Selecionar Dente ${tooth}`
        }
        className={`group relative flex flex-col items-center justify-between p-1 sm:p-1.5 rounded-xl border transition-all cursor-pointer select-none ${
          isSelected
            ? 'border-[#8B0000] bg-[#FAF8F5] ring-2 ring-[#8B0000]/25 shadow-sm -translate-y-0.5'
            : hasProcedures
            ? 'border-[#C09553] bg-amber-50/30 hover:border-[#8B0000]'
            : 'border-zinc-200/80 bg-white hover:border-[#C09553] hover:bg-zinc-50/70'
        }`}
      >
        {/* Top number for Upper arch, or dots for Lower arch */}
        {isUpper && (
          <span
            className={`text-[10px] sm:text-[11px] font-mono font-extrabold leading-none ${
              isSelected
                ? 'text-[#8B0000]'
                : hasProcedures
                ? 'text-zinc-900'
                : 'text-zinc-500 group-hover:text-zinc-800'
            }`}
          >
            {tooth}
          </span>
        )}

        {/* Tooth SVG */}
        <div className="my-0.5 flex items-center justify-center">{renderCrownSvg()}</div>

        {/* Procedure color dots */}
        <div className="flex items-center justify-center gap-0.5 min-h-[10px]">
          {mappedProcs.slice(0, 4).map((mp, idx) => (
            <span
              key={`${mp.proc.id}-${idx}`}
              className="w-2 h-2 rounded-full border border-white shadow-2xs"
              style={{ backgroundColor: mp.proc.color }}
            />
          ))}
          {mappedProcs.length > 4 && (
            <span className="text-[8px] font-bold text-zinc-500">+{mappedProcs.length - 4}</span>
          )}
        </div>

        {!isUpper && (
          <span
            className={`text-[10px] sm:text-[11px] font-mono font-extrabold leading-none mt-0.5 ${
              isSelected
                ? 'text-[#8B0000]'
                : hasProcedures
                ? 'text-zinc-900'
                : 'text-zinc-500 group-hover:text-zinc-800'
            }`}
          >
            {tooth}
          </span>
        )}

        {/* Stage badge pill on corner if mapped */}
        {primaryStage && (
          <span
            className="absolute -top-1.5 -right-1.5 px-1 py-0.2 rounded-full text-[8px] font-extrabold text-white shadow-xs"
            style={{ backgroundColor: primaryStage.color }}
          >
            {primaryStage.id === 'stage_1'
              ? 'F1'
              : primaryStage.id === 'stage_2'
              ? 'F2'
              : 'F3'}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="bg-white border border-[#E6DEC9] rounded-2xl p-4 sm:p-6 shadow-sm space-y-6">
      {/* Top Bar: Title + Interaction Modes + Quick Presets */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#8B0000]/10 text-[#8B0000]">
              Mapeamento Rápido em Consulta
            </span>
            <span className="text-[11px] text-zinc-400 font-medium">
              Sem precisar subir fotos ou arrastar bolinhas
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-serif font-bold text-[#8B0000] flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-[#C09553]" />
            Odontograma de Arcada 2D & Divisão por Etapas
          </h3>
        </div>

        {/* Mode Switcher: Selecionar Dente vs Carimbo Rápido */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-[#FAF8F5] p-1 border border-[#E6DEC9]">
            <button
              type="button"
              onClick={() => setInteractionMode('select_tooth')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                interactionMode === 'select_tooth'
                  ? 'bg-[#8B0000] text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <MousePointerClick className="w-3.5 h-3.5" />
              <span>1. Clicar no Dente</span>
            </button>
            <button
              type="button"
              onClick={() => setInteractionMode('paint_procedure')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                interactionMode === 'paint_procedure'
                  ? 'bg-[#8B0000] text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
              title="Escolha um procedimento abaixo e vá clicando nos dentes para aplicar com 1 toque"
            >
              <Paintbrush className="w-3.5 h-3.5" />
              <span>2. Modo Carimbo (1 Toque)</span>
            </button>
          </div>

          {interactionMode === 'select_tooth' && (
            <button
              type="button"
              onClick={() => setMultiSelectMode((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                multiSelectMode
                  ? 'bg-amber-50 border-[#C09553] text-[#8B0000]'
                  : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
              }`}
              title="Permite selecionar vários dentes ao mesmo tempo (ex: 13 ao 23 para facetas)"
            >
              {multiSelectMode ? (
                <CheckSquare className="w-3.5 h-3.5 text-[#8B0000]" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
              <span>Vários Dentes ({selectedTeeth.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Group Selection Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FAF8F5] border border-[#E6DEC9] rounded-xl px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mr-1">
            Atalhos de Seleção:
          </span>
          <button
            type="button"
            onClick={() => {
              setInteractionMode('select_tooth');
              setSelectedTeeth([0]);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
              selectedTeeth.length === 1 && selectedTeeth[0] === 0
                ? 'bg-[#8B0000] text-white border-[#8B0000]'
                : 'bg-white text-zinc-700 border-zinc-200 hover:border-[#C09553]'
            }`}
          >
            👄 Boca Toda / Geral (Limpeza, Clareamento...)
          </button>
          <button
            type="button"
            onClick={() => {
              setInteractionMode('select_tooth');
              setMultiSelectMode(true);
              setSelectedTeeth([13, 12, 11, 21, 22, 23]);
            }}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white text-zinc-700 border border-zinc-200 hover:border-[#C09553] cursor-pointer"
          >
            😁 Anteriores Sup. (13 a 23)
          </button>
          <button
            type="button"
            onClick={() => {
              setInteractionMode('select_tooth');
              setMultiSelectMode(true);
              setSelectedTeeth([43, 42, 41, 31, 32, 33]);
            }}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white text-zinc-700 border border-zinc-200 hover:border-[#C09553] cursor-pointer"
          >
            Anteriores Inf. (43 a 33)
          </button>
          <button
            type="button"
            onClick={() => {
              setInteractionMode('select_tooth');
              setMultiSelectMode(true);
              setSelectedTeeth([18, 28, 38, 48]);
            }}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white text-zinc-700 border border-zinc-200 hover:border-[#C09553] cursor-pointer"
          >
            🦷 4 Sisos (18, 28, 38, 48)
          </button>
        </div>

        {/* Stage Default Selector for Next Procedure */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Etapa ao Lançar:
          </span>
          <select
            value={forcedStageId}
            onChange={(e) => setForcedStageId(e.target.value as any)}
            className="bg-white border border-[#D5CBB3] rounded-lg px-2.5 py-1 text-xs font-bold text-[#8B0000] focus:outline-none focus:border-[#8B0000]"
          >
            <option value="auto">✨ Automático por Tipo (Recomendado)</option>
            {stages.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Left = 2D Dental Arch (Upper + Lower), Right = Procedure Picker & Active Tooth Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: 2D Anatomical Arch */}
        <div className="xl:col-span-7 bg-[#FAF8F5] border border-[#E6DEC9] rounded-2xl p-4 sm:p-5 space-y-5">
          {/* Upper Arch */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-1">
              <span>Quadrante 1 (Dir. Paciente)</span>
              <span className="text-[#8B0000] font-serif text-xs">ARCADA SUPERIOR</span>
              <span>Quadrante 2 (Esq. Paciente)</span>
            </div>

            <div className="overflow-x-auto pb-1">
              <div className="min-w-[540px] grid grid-cols-16 gap-1 items-end">
                {UPPER_RIGHT.map((t) => renderToothButton(t, true))}
                {UPPER_LEFT.map((t) => renderToothButton(t, true))}
              </div>
            </div>
          </div>

          {/* Midline Divider + Whole Mouth Button */}
          <div className="relative flex items-center justify-center py-1">
            <div className="w-full border-t border-dashed border-[#D5CBB3]" />
            <button
              type="button"
              onClick={() => handleToothClick(0)}
              className={`mx-3 shrink-0 px-3.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedTeeth.includes(0)
                  ? 'bg-[#8B0000] text-white border-[#8B0000] shadow-xs'
                  : (markersByTooth.get(0)?.length || 0) > 0
                  ? 'bg-amber-50 text-[#8B0000] border-[#C09553]'
                  : 'bg-white text-zinc-600 border-[#E6DEC9] hover:border-[#C09553]'
              }`}
            >
              <span>Arcada Completa / Procedimentos Gerais</span>
              {(markersByTooth.get(0)?.reduce((s, e) => s + e.marker.procedures.length, 0) || 0) >
                0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#C09553] text-white text-[10px]">
                  {markersByTooth.get(0)?.reduce((s, e) => s + e.marker.procedures.length, 0)}
                </span>
              )}
            </button>
            <div className="w-full border-t border-dashed border-[#D5CBB3]" />
          </div>

          {/* Lower Arch */}
          <div className="space-y-2">
            <div className="overflow-x-auto pt-1">
              <div className="min-w-[540px] grid grid-cols-16 gap-1 items-start">
                {LOWER_RIGHT.map((t) => renderToothButton(t, false))}
                {LOWER_LEFT.map((t) => renderToothButton(t, false))}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-1">
              <span>Quadrante 4 (Dir. Paciente)</span>
              <span className="text-[#8B0000] font-serif text-xs">ARCADA INFERIOR</span>
              <span>Quadrante 3 (Esq. Paciente)</span>
            </div>
          </div>

          {/* Clinical Note for Selected Tooth */}
          <div className="pt-3 border-t border-[#E6DEC9] flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <span className="text-[11px] font-bold text-[#8B0000] uppercase tracking-wide shrink-0 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-[#C09553]" />
              Obs. {primaryTooth === 0 ? 'Geral' : `Dente ${primaryTooth}`}:
            </span>
            <input
              type="text"
              value={primaryToothNote}
              onChange={(e) => handleUpdateToothNote(primaryTooth, e.target.value)}
              placeholder={`Observação clínica opcional para ${
                primaryTooth === 0 ? 'boca toda' : `o dente ${primaryTooth}`
              }...`}
              className="flex-1 bg-white border border-[#D5CBB3] rounded-lg px-3 py-1.5 text-xs text-zinc-800 focus:outline-none focus:border-[#8B0000]"
            />
          </div>
        </div>

        {/* Right 5 Cols: Quick Procedure Selector for Selected Teeth */}
        <div className="xl:col-span-5 bg-white border border-[#E6DEC9] rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#C09553] block">
                {interactionMode === 'paint_procedure'
                  ? 'Modo Carimbo Ativo'
                  : 'Procedimentos para Seleção'}
              </span>
              <h4 className="text-sm font-serif font-bold text-[#8B0000]">
                {interactionMode === 'paint_procedure'
                  ? 'Escolha o procedimento e clique nos dentes'
                  : selectedTeeth.length === 1
                  ? selectedTeeth[0] === 0
                    ? '👄 Boca Toda / Geral'
                    : `🦷 Dente ${selectedTeeth[0]} Selecionado`
                  : `🦷 ${selectedTeeth.length} Dentes Selecionados (${selectedTeeth.join(', ')})`}
              </h4>
            </div>

            {onAddProcedure && (
              <button
                type="button"
                onClick={() => setShowNewProcForm((v) => !v)}
                className="px-2.5 py-1.5 rounded-lg bg-[#FAF8F5] hover:bg-[#8B0000] text-[#8B0000] hover:text-white border border-[#C09553]/40 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo</span>
              </button>
            )}
          </div>

          {/* Inline New Procedure Form */}
          {showNewProcForm && onAddProcedure && (
            <div className="bg-[#FAF8F5] border border-[#D5CBB3] rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#8B0000] uppercase">
                  Cadastrar Novo Procedimento
                </span>
                <button
                  type="button"
                  onClick={() => setShowNewProcForm(false)}
                  className="text-zinc-400 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Nome (ex: Coroa Zircônia)"
                  value={newProcName}
                  onChange={(e) => setNewProcName(e.target.value)}
                  className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#8B0000]"
                />
                <input
                  type="number"
                  placeholder="Valor (R$)"
                  value={newProcPrice}
                  onChange={(e) => setNewProcPrice(e.target.value)}
                  className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-[#8B0000]"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <select
                  value={newProcStage}
                  onChange={(e) => setNewProcStage(e.target.value)}
                  className="bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-xs text-zinc-700 flex-1"
                >
                  {stages.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (!newProcName.trim()) return;
                    const created: Procedure = {
                      id: `proc_${Date.now()}`,
                      name: newProcName.trim(),
                      price: parseFloat(newProcPrice) || 0,
                      color:
                        newProcStage === 'stage_1'
                          ? '#dc2626'
                          : newProcStage === 'stage_3'
                          ? '#059669'
                          : '#d97706',
                      defaultStageId: newProcStage,
                    };
                    onAddProcedure(created);
                    toggleProcedureOnTeeth(selectedTeeth, created.id, newProcStage);
                    setNewProcName('');
                    setNewProcPrice('');
                    setShowNewProcForm(false);
                  }}
                  className="px-3 py-1.5 bg-[#8B0000] text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Criar e Aplicar
                </button>
              </div>
            </div>
          )}

          {/* Search input */}
          <input
            type="text"
            placeholder="🔍 Buscar procedimento (ex: resina, canal, implante, limpeza)..."
            value={searchProcedure}
            onChange={(e) => setSearchProcedure(e.target.value)}
            className="w-full bg-[#FAF8F5] border border-[#E6DEC9] rounded-xl px-3 py-2 text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-[#8B0000]"
          />

          {/* Procedure Grid Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[310px] overflow-y-auto pr-1">
            {filteredProcedures.map((proc) => {
              const isAppliedToAllSelected =
                selectedTeeth.length > 0 &&
                selectedTeeth.every((tNum) => {
                  const entries = markersByTooth.get(tNum) || [];
                  return entries.some((e) => e.marker.procedures.includes(proc.id));
                });

              const isPaintActive =
                interactionMode === 'paint_procedure' && activePaintProcedureId === proc.id;

              const naturalStageId =
                proc.defaultStageId || getDefaultStageForProcedure(proc.name, proc.id);
              const stageObj = stages.find((s) => s.id === naturalStageId);

              if (editingProcId === proc.id) {
                return (
                  <div
                    key={proc.id}
                    className="col-span-2 bg-[#FAF8F5] border border-[#C09553] rounded-xl p-2 flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      value={editProcName}
                      onChange={(e) => setEditProcName(e.target.value)}
                      className="flex-1 bg-white border border-zinc-200 rounded px-2 py-1 text-xs"
                    />
                    <input
                      type="number"
                      value={editProcPrice}
                      onChange={(e) => setEditProcPrice(e.target.value)}
                      className="w-20 bg-white border border-zinc-200 rounded px-2 py-1 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (onEditProcedure && editProcName.trim()) {
                          onEditProcedure({
                            ...proc,
                            name: editProcName.trim(),
                            price: parseFloat(editProcPrice) || 0,
                          });
                        }
                        setEditingProcId(null);
                      }}
                      className="p-1 text-emerald-700 hover:bg-emerald-50 rounded"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingProcId(null)}
                      className="p-1 text-zinc-400 hover:text-zinc-600 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={proc.id}
                  className={`group flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-xl border text-left transition-all ${
                    isPaintActive
                      ? 'bg-[#8B0000] text-white border-[#8B0000] shadow-xs'
                      : isAppliedToAllSelected
                      ? 'bg-emerald-50/90 border-emerald-400 text-emerald-950 shadow-2xs'
                      : 'bg-white border-zinc-200/80 hover:border-[#C09553] hover:bg-[#FAF8F5]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (interactionMode === 'paint_procedure') {
                        setActivePaintProcedureId(proc.id);
                      } else {
                        toggleProcedureOnTeeth(selectedTeeth, proc.id);
                      }
                    }}
                    className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/60"
                      style={{ backgroundColor: proc.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-bold truncate ${
                          isPaintActive ? 'text-white' : 'text-zinc-800'
                        }`}
                      >
                        {proc.name}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10.5px] font-mono font-bold ${
                            isPaintActive ? 'text-amber-200' : 'text-[#8B0000]'
                          }`}
                        >
                          {formatCurrency(proc.price)}
                        </span>
                        {stageObj && (
                          <span
                            className="text-[8.5px] font-bold px-1 rounded uppercase"
                            style={{
                              backgroundColor: isPaintActive ? 'rgba(255,255,255,0.2)' : `${stageObj.color}18`,
                              color: isPaintActive ? '#fff' : stageObj.color,
                            }}
                          >
                            {stageObj.id === 'stage_1'
                              ? 'Fase 1'
                              : stageObj.id === 'stage_2'
                              ? 'Fase 2'
                              : 'Fase 3'}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {onEditProcedure && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingProcId(proc.id);
                        setEditProcName(proc.name);
                        setEditProcPrice(String(proc.price));
                      }}
                      className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity cursor-pointer ${
                        isPaintActive ? 'text-white/80 hover:text-white' : 'text-zinc-400 hover:text-[#8B0000]'
                      }`}
                      title="Editar nome ou valor padrão"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Summary by Clinical Stage + Quick Stage Reassignment List */}
      <div className="border-t border-[#E6DEC9] pt-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#8B0000] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#C09553]" />
              Resumo das Etapas Planejadas ({allMappedItems.length} procedimentos)
            </h4>
            <p className="text-[11px] text-zinc-500">
              Você pode mudar a etapa de qualquer procedimento abaixo ou ativar/desativar etapas inteiras na aba de Orçamento.
            </p>
          </div>

          {onGoToNegotiation && (
            <button
              type="button"
              onClick={onGoToNegotiation}
              className="px-4 py-2.5 bg-[#8B0000] hover:bg-[#6e0000] text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 transition-all cursor-pointer shrink-0"
            >
              <span>Simular Etapas e Pagamento com o Paciente</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 3 Stage Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {stages.map((st) => {
            const stat = stageTotals[st.id] || { count: 0, total: 0 };
            const itemsInStage = allMappedItems.filter((i) => i.stageId === st.id);

            return (
              <div
                key={st.id}
                className="rounded-xl border border-[#E6DEC9] bg-[#FAF8F5] p-3.5 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[11px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-md text-white"
                      style={{ backgroundColor: st.color }}
                    >
                      {st.label}
                    </span>
                    <span className="font-mono font-extrabold text-sm text-zinc-900">
                      {formatCurrency(stat.total)}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-zinc-500 leading-snug">{st.subtitle}</p>

                  {itemsInStage.length === 0 ? (
                    <p className="text-[11px] text-zinc-400 italic py-2">
                      Nenhum procedimento nesta etapa.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 pt-1">
                      {itemsInStage.map((item, idx) => (
                        <div
                          key={`${item.markerId}-${item.procedureId}-${idx}`}
                          className="bg-white border border-zinc-200/80 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-mono font-bold text-[#8B0000] mr-1.5">
                              {item.toothNumber === 0 ? 'Geral' : `D${item.toothNumber}`}
                            </span>
                            <span className="font-medium text-zinc-800 truncate">
                              {item.procedureName}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-mono font-bold text-zinc-700 text-[11px]">
                              {formatCurrency(item.price)}
                            </span>
                            <select
                              value={item.stageId}
                              onChange={(e) =>
                                handleChangeProcedureStage(
                                  item.toothNumber,
                                  item.procedureId,
                                  e.target.value
                                )
                              }
                              title="Mover para outra etapa"
                              className="bg-zinc-50 border border-zinc-200 rounded px-1 py-0.5 text-[10px] font-bold text-zinc-600 cursor-pointer"
                            >
                              <option value="stage_1">F1</option>
                              <option value="stage_2">F2</option>
                              <option value="stage_3">F3</option>
                            </select>
                            <button
                              type="button"
                              onClick={() =>
                                toggleProcedureOnTeeth([item.toothNumber], item.procedureId)
                              }
                              className="text-zinc-400 hover:text-red-600 p-0.5 cursor-pointer"
                              title="Remover procedimento"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-zinc-200/60 flex justify-between items-center text-[10.5px] text-zinc-500 font-semibold">
                  <span>{stat.count} procedimento(s)</span>
                  <span>
                    {grandTotal > 0 ? `${Math.round((stat.total / grandTotal) * 100)}% do total` : '0%'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
