import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import { TreatmentPlan, TreatmentTooth, TreatmentProcedure, Viewer3DState, ToothCondition, ToothSurface, LayerKey, LayerConfig } from '../types';
import { usePatientContext } from '../../context/PatientContext';

interface Planning3DContextType {
  activePlan: TreatmentPlan | null;
  teeth: Record<number, TreatmentTooth>;
  procedures: TreatmentProcedure[];
  globalProcedures: any[];
  viewerState: Viewer3DState;
  setActivePlan: (plan: TreatmentPlan | null) => void;
  selectTooth: (toothNumber: number | null, pos?: { x: number, y: number }) => void;
  selectSurface: (surface: ToothSurface) => void;
  updateToothCondition: (toothNumber: number, condition: ToothCondition, notes?: string) => void;
  updateToothSurfaceCondition: (toothNumber: number, surface: ToothSurface, condition: ToothCondition) => void;
  addProcedure: (toothNumber: number, procedureId: string, price: number, name: string) => void;
  removeProcedure: (procedureInstanceId: string) => void;
  setTransparencyMode: (mode: boolean) => void;
  setLoading: (loading: boolean) => void;
  setPresentationMode: (mode: boolean) => void;
  setSimulationState: (state: 'BEFORE' | 'AFTER') => void;
  acceptPlan: () => void;
  setLayerVisibility: (layerKey: LayerKey, visible: boolean) => void;
  setLayerOpacity: (layerKey: LayerKey, opacity: number) => void;
  toggleMissingTooth: (toothNumber: number) => void;
  setViewingAnatomy: (state: boolean) => void;
  onOpenProcedureManager?: () => void;
}

const Planning3DContext = createContext<Planning3DContextType | undefined>(undefined);

export function Planning3DProvider({ children, globalProcedures = [], onOpenProcedureManager }: { children: ReactNode, globalProcedures?: any[], onOpenProcedureManager?: () => void }) {
  // Integração unificada com o CRM
  const { activeSections, setActiveSections, activeProposal, setActiveProposal, selectedPatient } = usePatientContext();

  const [viewerState, setViewerState] = useState<Viewer3DState>({
    activeTooth: null,
    viewingAnatomy: false,
    activeSurfaces: [],
    transparencyMode: false,
    loading: false,
    presentationMode: false,
    simulationState: 'BEFORE',
    missingTeeth: [],
    layers: {
      gums: { visible: true, opacity: 0.95 },
      bone: { visible: true, opacity: 0.8 },
      teeth: { visible: true, opacity: 1.0 },
      roots: { visible: true, opacity: 1.0 },
      pulp: { visible: true, opacity: 1.0 },
      canals: { visible: true, opacity: 1.0 },
      nerves: { visible: true, opacity: 1.0 },
      sinus: { visible: true, opacity: 1.0 },
    },
  });

  const setViewingAnatomy = (state: boolean) => {
    setViewerState(prev => ({ ...prev, viewingAnatomy: state }));
  };

  const toggleMissingTooth = (toothNumber: number) => {
    setViewerState(prev => {
      const isMissing = prev.missingTeeth.includes(toothNumber);
      return {
        ...prev,
        missingTeeth: isMissing 
          ? prev.missingTeeth.filter(t => t !== toothNumber) 
          : [...prev.missingTeeth, toothNumber]
      };
    });
  };

  // 1. Derivar o estado local (teeth, procedures) a partir das activeSections globais
  const { teeth, procedures } = useMemo(() => {
    const t: Record<number, TreatmentTooth> = {};
    const p: TreatmentProcedure[] = [];

    activeSections.forEach(section => {
      section.markers.forEach(marker => {
        if (!t[marker.toothNumber]) {
          t[marker.toothNumber] = {
            id: marker.id,
            plan_id: activeProposal?.patientName || 'plan',
            tooth: marker.toothNumber,
            condition: marker.condition || 'HEALTHY',
            notes: marker.notes || '',
            surfaces: marker.surfaces || {}
          };
        }
        
        if (marker.procedureInstances) {
          marker.procedureInstances.forEach(inst => {
            p.push({
              id: inst.id,
              tooth_id: marker.id,
              procedure: inst.name,
              price: inst.price
            });
          });
        } else if (marker.procedures) {
          // Compatibilidade antiga
          marker.procedures.forEach(procId => {
            const procInfo = globalProcedures.find(p => p.id === procId);
            if (procInfo) {
              p.push({
                id: `${marker.id}-${procId}`,
                tooth_id: marker.id,
                procedure: procInfo.name,
                price: procInfo.price
              });
            }
          });
        }
      });
    });

    return { teeth: t, procedures: p };
  }, [activeSections, activeProposal, globalProcedures]);

  const activePlan: TreatmentPlan = {
    id: 'unified-plan',
    patient_id: selectedPatient?.id || 'unknown',
    created_at: new Date().toISOString(),
    status: 'DRAFT'
  };

  const setActivePlan = () => {};

  const getSectionForTooth = (toothNumber: number) => {
    return toothNumber < 30 ? 'upper' : 'lower';
  };

  const updateMarkerInSections = (toothNumber: number, updater: (marker: any) => any) => {
    setActiveSections(prev => {
      let found = false;
      const newSections = prev.map(sec => {
        const markerIndex = sec.markers.findIndex(m => m.toothNumber === toothNumber);
        if (markerIndex !== -1) {
          found = true;
          const newMarkers = [...sec.markers];
          newMarkers[markerIndex] = updater({ ...newMarkers[markerIndex] });
          return { ...sec, markers: newMarkers };
        }
        return sec;
      });

      if (!found) {
        // Create new marker if it doesn't exist
        const targetSecId = getSectionForTooth(toothNumber);
        const newMarker = updater({
          id: `${targetSecId}-${toothNumber}-${Date.now()}`,
          toothNumber,
          x: 0,
          y: 0,
          procedures: [],
          procedureInstances: [],
          condition: 'HEALTHY',
          surfaces: {}
        });
        
        return newSections.map(sec => 
          sec.id === targetSecId ? { ...sec, markers: [...sec.markers, newMarker] } : sec
        );
      }

      return newSections;
    });
  };

  const selectTooth = (toothNumber: number | null, pos?: { x: number, y: number }) => {
    if (viewerState.presentationMode) return;
    setViewerState((prev) => ({
      ...prev,
      activeTooth: toothNumber,
      activeToothPos: toothNumber === null ? null : pos,
      activeSurfaces: [],
    }));
  };

  const selectSurface = (surface: ToothSurface) => {
    if (viewerState.presentationMode) return;
    setViewerState((prev) => {
      const exists = prev.activeSurfaces.includes(surface);
      const newSurfaces = exists
        ? prev.activeSurfaces.filter((s) => s !== surface)
        : [...prev.activeSurfaces, surface];
      return {
        ...prev,
        activeSurfaces: newSurfaces,
      };
    });
  };

  const updateToothCondition = (toothNumber: number, condition: ToothCondition, notes?: string) => {
    updateMarkerInSections(toothNumber, (marker) => {
      return {
        ...marker,
        condition,
        notes: notes !== undefined ? notes : marker.notes
      };
    });
  };

  const updateToothSurfaceCondition = (toothNumber: number, surface: ToothSurface, condition: ToothCondition) => {
    updateMarkerInSections(toothNumber, (marker) => {
      const updatedSurfaces = { ...(marker.surfaces || {}), [surface]: condition };
      let toothCond = marker.condition || 'HEALTHY';
      if (condition === 'CARIES' || condition === 'FRACTURE') {
        toothCond = condition;
      }
      return {
        ...marker,
        condition: toothCond,
        surfaces: updatedSurfaces
      };
    });
  };

  const addProcedure = (toothNumber: number, procedureId: string, price: number, name: string) => {
    updateMarkerInSections(toothNumber, (marker) => {
      const newInst = {
        id: `inst-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        procedureId,
        name,
        price,
        includeFinancial: true,
        status: 'A realizar',
        date: new Date().toISOString(),
        dentist: 'Sistema 3D'
      };
      
      const instances = [...(marker.procedureInstances || []), newInst];
      const procs = [...(marker.procedures || []), procedureId];
      
      return { ...marker, procedureInstances: instances, procedures: procs };
    });
  };

  const removeProcedure = (procedureInstanceId: string) => {
    setActiveSections(prev => {
      return prev.map(sec => ({
        ...sec,
        markers: sec.markers.map(m => ({
          ...m,
          procedureInstances: (m.procedureInstances || []).filter(inst => inst.id !== procedureInstanceId)
        }))
      }));
    });
  };

  const setTransparencyMode = (mode: boolean) => {
    setViewerState((prev) => ({
      ...prev,
      transparencyMode: mode,
      layers: {
        ...prev.layers,
        gums: { ...prev.layers.gums, opacity: mode ? 0.2 : 0.95 },
        bone: { ...prev.layers.bone, opacity: mode ? 0.1 : 0.8 },
      },
    }));
  };

  const setLoading = (loading: boolean) => {
    setViewerState((prev) => ({ ...prev, loading }));
  };

  const setPresentationMode = (mode: boolean) => {
    setViewerState((prev) => ({
      ...prev,
      presentationMode: mode,
      activeTooth: null,
      activeSurfaces: [],
      simulationState: 'BEFORE',
    }));
  };

  const setSimulationState = (state: 'BEFORE' | 'AFTER') => {
    setViewerState((prev) => ({ ...prev, simulationState: state }));
  };

  const acceptPlan = () => {};

  const setLayerVisibility = (layerKey: LayerKey, visible: boolean) => {
    setViewerState((prev) => ({
      ...prev,
      layers: {
        ...prev.layers,
        [layerKey]: { ...prev.layers[layerKey], visible },
      },
    }));
  };

  const setLayerOpacity = (layerKey: LayerKey, opacity: number) => {
    setViewerState((prev) => ({
      ...prev,
      layers: {
        ...prev.layers,
        [layerKey]: { ...prev.layers[layerKey], opacity },
      },
    }));
  };

  return (
    <Planning3DContext.Provider
      value={{
        activePlan,
        teeth,
        procedures,
        globalProcedures,
        viewerState,
        setActivePlan,
        selectTooth,
        selectSurface,
        updateToothCondition,
        updateToothSurfaceCondition,
        addProcedure,
        removeProcedure,
        setTransparencyMode,
        setLoading,
        setPresentationMode,
        setSimulationState,
        acceptPlan,
        toggleMissingTooth,
        setViewingAnatomy,
        setLayerVisibility,
        setLayerOpacity,
        onOpenProcedureManager,
      }}
    >
      {children}
    </Planning3DContext.Provider>
  );
}

export function usePlanning3DContext() {
  const context = useContext(Planning3DContext);
  if (!context) {
    throw new Error('usePlanning3DContext deve ser usado dentro de um Planning3DProvider');
  }
  return context;
}

