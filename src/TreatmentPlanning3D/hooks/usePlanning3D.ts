import { usePlanning3DContext } from '../context/Planning3DContext';
import { ToothSurface, ToothCondition } from '../types';

export function usePlanning3D() {
  const {
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
    setLayerVisibility,
    setLayerOpacity,
    setViewingAnatomy,
    toggleMissingTooth,
    onOpenProcedureManager,
  } = usePlanning3DContext();

  // Helper selectors
  const getToothState = (toothNumber: number) => {
    return teeth[toothNumber] || null;
  };

  const getSurfaceCondition = (toothNumber: number, surface: ToothSurface): ToothCondition => {
    const tooth = teeth[toothNumber];
    if (!tooth || !tooth.surfaces) return 'HEALTHY';
    return tooth.surfaces[surface] || 'HEALTHY';
  };

  const getToothProcedures = (toothNumber: number) => {
    const tooth = teeth[toothNumber];
    if (!tooth) return [];
    return procedures.filter((p) => p.tooth_id === tooth.id);
  };

  const getPlanTotal = () => {
    return procedures.reduce((sum, p) => sum + p.price, 0);
  };

  return {
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
    setTransparencyMode,
    setLoading,
    setPresentationMode,
    setSimulationState,
    acceptPlan,
    addProcedure,
    removeProcedure,
    setLayerVisibility,
    setLayerOpacity,
    setViewingAnatomy,
    toggleMissingTooth,
    getToothState,
    getSurfaceCondition,
    getToothProcedures,
    getPlanTotal,
    onOpenProcedureManager,
  };
}
