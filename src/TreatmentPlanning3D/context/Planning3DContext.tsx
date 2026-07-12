import React, { createContext, useContext, useState, ReactNode, useMemo, useRef, useEffect } from 'react';
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
  updateProcedure: (instanceId: string, updates: { name?: string; price?: number }) => void;
  setTransparencyMode: (mode: boolean) => void;
  setLoading: (loading: boolean) => void;
  setPresentationMode: (mode: boolean) => void;
  setSimulationState: (state: 'BEFORE' | 'AFTER') => void;
  acceptPlan: (signature?: string) => void;
  setLayerVisibility: (layerKey: LayerKey, visible: boolean) => void;
  setLayerOpacity: (layerKey: LayerKey, opacity: number) => void;
  toggleMissingTooth: (toothNumber: number) => void;
  setViewingAnatomy: (state: boolean) => void;
  onOpenProcedureManager?: () => void;
  planStatus: 'DRAFT' | 'ACCEPTED';
  signatureData: string | null;
  setPlanStatus: (status: 'DRAFT' | 'ACCEPTED') => void;
  setSignatureData: (sig: string | null) => void;
}

const Planning3DContext = createContext<Planning3DContextType | undefined>(undefined);

const isPresentation = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'presentation';

export function Planning3DProvider({ children, globalProcedures = [], onOpenProcedureManager }: { children: ReactNode, globalProcedures?: any[], onOpenProcedureManager?: () => void }) {
  // Integração unificada com o CRM
  const { activeSections, setActiveSections, activeProposal, setActiveProposal, selectedPatient, saveContextToSupabase } = usePatientContext();

  const [viewerState, setViewerState] = useState<Viewer3DState>({
    activeTooth: null,
    viewingAnatomy: false,
    activeSurfaces: [],
    transparencyMode: false,
    loading: false,
    presentationMode: isPresentation,
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
              price: inst.price,
              procedureId: inst.procedureId,
              surfaces: inst.faces || []
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
        dentist: 'Sistema 3D',
        faces: [...viewerState.activeSurfaces]
      };
      
      const instances = [...(marker.procedureInstances || []), newInst];
      const procs = [...(marker.procedures || []), procedureId];
      
      return { ...marker, procedureInstances: instances, procedures: procs };
    });

    // Limpar faces selecionadas após o lançamento do procedimento
    selectTooth(toothNumber);
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

  const updateProcedure = (instanceId: string, updates: { name?: string; price?: number }) => {
    setActiveSections(prev => {
      return prev.map(sec => ({
        ...sec,
        markers: sec.markers.map(m => ({
          ...m,
          procedureInstances: (m.procedureInstances || []).map(inst => {
            if (inst.id !== instanceId) return inst;
            return {
              ...inst,
              ...(updates.name !== undefined && { name: updates.name }),
              ...(updates.price !== undefined && { price: updates.price }),
            };
          })
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

  const [planStatus, setPlanStatus] = useState<'DRAFT' | 'ACCEPTED'>('DRAFT');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [pendingSave, setPendingSave] = useState(false);

  const acceptPlan = (signature?: string) => {
    setPlanStatus('ACCEPTED');
    if (signature) {
      setSignatureData(signature);
    }
    
    if (isPresentation) {
      const channel = new BroadcastChannel('planning_3d_channel');
      channel.postMessage({
        type: 'accept_plan_viewer',
        payload: { signatureData: signature || null }
      });
      channel.close();
    } else {
      setActiveProposal(prev => ({
        ...prev,
        status: 'Aprovado (paciente pagou)'
      }));
      setPendingSave(true);
    }
  };

  useEffect(() => {
    if (pendingSave && activeProposal.status === 'Aprovado (paciente pagou)') {
      setPendingSave(false);
      saveContextToSupabase().catch(err => {
        console.error("Erro ao salvar aceite do plano no Supabase:", err);
      });
    }
  }, [pendingSave, activeProposal, saveContextToSupabase]);

  // Sync state via BroadcastChannel
  const latestViewerStateRef = useRef({ viewerState, planStatus, signatureData });
  useEffect(() => {
    latestViewerStateRef.current = { viewerState, planStatus, signatureData };
  }, [viewerState, planStatus, signatureData]);

  useEffect(() => {
    const channel = new BroadcastChannel('planning_3d_channel');

    if (!isPresentation) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'request_initial_viewer_state') {
          const current = latestViewerStateRef.current;
          channel.postMessage({
            type: 'viewer_sync',
            payload: {
              viewerState: current.viewerState,
              planStatus: current.planStatus,
              signatureData: current.signatureData
            }
          });
        } else if (event.data?.type === 'accept_plan_viewer') {
          acceptPlan(event.data.payload?.signatureData);
        }
      };
      channel.addEventListener('message', handleMessage);
      return () => {
        channel.removeEventListener('message', handleMessage);
        channel.close();
      };
    } else {
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'viewer_sync' && event.data.payload) {
          const { viewerState: syncViewerState, planStatus: syncPlanStatus, signatureData: syncSignatureData } = event.data.payload;
          setViewerState({
            ...syncViewerState,
            presentationMode: true
          });
          setPlanStatus(syncPlanStatus);
          setSignatureData(syncSignatureData);
        }
      };
      channel.addEventListener('message', handleMessage);
      channel.postMessage({ type: 'request_initial_viewer_state' });
      return () => {
        channel.removeEventListener('message', handleMessage);
        channel.close();
      };
    }
  }, []);

  useEffect(() => {
    if (!isPresentation) {
      const channel = new BroadcastChannel('planning_3d_channel');
      channel.postMessage({
        type: 'viewer_sync',
        payload: { viewerState, planStatus, signatureData }
      });
      return () => {
        channel.close();
      };
    }
  }, [viewerState, planStatus, signatureData]);

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
        updateProcedure,
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
        planStatus,
        signatureData,
        setPlanStatus,
        setSignatureData,
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

