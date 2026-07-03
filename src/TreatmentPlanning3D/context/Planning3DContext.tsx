import React, { createContext, useContext, useState, ReactNode } from 'react';
import { TreatmentPlan, TreatmentTooth, TreatmentProcedure, Viewer3DState, ToothCondition, ToothSurface, LayerKey, LayerConfig } from '../types';

interface Planning3DContextType {
  activePlan: TreatmentPlan | null;
  teeth: Record<number, TreatmentTooth>;
  procedures: TreatmentProcedure[];
  viewerState: Viewer3DState;
  setActivePlan: (plan: TreatmentPlan | null) => void;
  selectTooth: (toothNumber: number | null) => void;
  selectSurface: (surface: ToothSurface) => void;
  updateToothCondition: (toothNumber: number, condition: ToothCondition, notes?: string) => void;
  updateToothSurfaceCondition: (toothNumber: number, surface: ToothSurface, condition: ToothCondition) => void;
  addProcedure: (toothNumber: number, procedureName: string, price: number) => void;
  removeProcedure: (procedureId: string) => void;
  setTransparencyMode: (mode: boolean) => void;
  setLoading: (loading: boolean) => void;
  setPresentationMode: (mode: boolean) => void;
  setSimulationState: (state: 'BEFORE' | 'AFTER') => void;
  acceptPlan: () => void;
  setLayerVisibility: (layerKey: LayerKey, visible: boolean) => void;
  setLayerOpacity: (layerKey: LayerKey, opacity: number) => void;
}

const Planning3DContext = createContext<Planning3DContextType | undefined>(undefined);

export function Planning3DProvider({ children }: { children: ReactNode }) {
  const [activePlan, setActivePlan] = useState<TreatmentPlan | null>({
    id: `plan-${Date.now()}`,
    patient_id: 'default-patient',
    created_at: new Date().toISOString(),
    status: 'DRAFT',
  });
  const [teeth, setTeeth] = useState<Record<number, TreatmentTooth>>({});
  const [procedures, setProcedures] = useState<TreatmentProcedure[]>([]);
  const [viewerState, setViewerState] = useState<Viewer3DState>({
    activeTooth: null,
    activeSurfaces: [],
    transparencyMode: false,
    loading: false,
    presentationMode: false,
    simulationState: 'BEFORE',
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

  const selectTooth = (toothNumber: number | null) => {
    // No modo de apresentação, desabilita a seleção detalhada individual por dente
    if (viewerState.presentationMode) return;
    
    setViewerState((prev) => ({
      ...prev,
      activeTooth: toothNumber,
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
    setTeeth((prev) => {
      const existing = prev[toothNumber] || {
        id: `tooth-${toothNumber}-${Date.now()}`,
        plan_id: activePlan?.id || 'temp-plan-id',
        tooth: toothNumber,
        condition: 'HEALTHY',
        notes: '',
        surfaces: {},
      };
      return {
        ...prev,
        [toothNumber]: {
          ...existing,
          condition,
          notes: notes !== undefined ? notes : existing.notes,
        },
      };
    });
  };

  const updateToothSurfaceCondition = (toothNumber: number, surface: ToothSurface, condition: ToothCondition) => {
    setTeeth((prev) => {
      const existing = prev[toothNumber] || {
        id: `tooth-${toothNumber}-${Date.now()}`,
        plan_id: activePlan?.id || 'temp-plan-id',
        tooth: toothNumber,
        condition: 'HEALTHY',
        notes: '',
        surfaces: {},
      };

      const existingSurfaces = existing.surfaces || {};
      const updatedSurfaces = {
        ...existingSurfaces,
        [surface]: condition,
      };

      let toothCondition = existing.condition;
      if (condition === 'CARIES' || condition === 'FRACTURE') {
        toothCondition = condition;
      }

      return {
        ...prev,
        [toothNumber]: {
          ...existing,
          condition: toothCondition,
          surfaces: updatedSurfaces,
        },
      };
    });
  };

  const addProcedure = (toothNumber: number, procedureName: string, price: number) => {
    setTeeth((prev) => {
      const toothId = prev[toothNumber]?.id || `tooth-${toothNumber}-${Date.now()}`;
      if (!prev[toothNumber]) {
        prev[toothNumber] = {
          id: toothId,
          plan_id: activePlan?.id || 'temp-plan-id',
          tooth: toothNumber,
          condition: 'HEALTHY',
          surfaces: {},
        };
      }

      const newProcedure: TreatmentProcedure = {
        id: `proc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        tooth_id: toothId,
        procedure: procedureName,
        price,
      };

      setProcedures((prevProcs) => [...prevProcs, newProcedure]);

      return { ...prev };
    });
  };

  const removeProcedure = (procedureId: string) => {
    setProcedures((prev) => prev.filter((p) => p.id !== procedureId));
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

  const acceptPlan = () => {
    setActivePlan((prev) => {
      if (!prev) return null;
      return { ...prev, status: 'ACCEPTED' };
    });
  };

  const setLayerVisibility = (layerKey: LayerKey, visible: boolean) => {
    setViewerState((prev) => ({
      ...prev,
      layers: {
        ...prev.layers,
        [layerKey]: {
          ...prev.layers[layerKey],
          visible,
        },
      },
    }));
  };

  const setLayerOpacity = (layerKey: LayerKey, opacity: number) => {
    setViewerState((prev) => ({
      ...prev,
      layers: {
        ...prev.layers,
        [layerKey]: {
          ...prev.layers[layerKey],
          opacity,
        },
      },
    }));
  };

  return (
    <Planning3DContext.Provider
      value={{
        activePlan,
        teeth,
        procedures,
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
        setLayerVisibility,
        setLayerOpacity,
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
