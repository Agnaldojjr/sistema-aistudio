export type PlanStatus = 'DRAFT' | 'PROPOSED' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';

export interface TreatmentPlan {
  id: string;
  patient_id: string;
  created_at: string;
  status: PlanStatus;
}

export type ToothCondition = 'HEALTHY' | 'CARIES' | 'FRACTURE' | 'MISSING' | 'PULPITIS' | 'BONE_LOSS' | 'IMPLANT' | 'CROWN';

export type ToothSurface = 'M' | 'D' | 'O' | 'I' | 'V' | 'L' | 'C';

export interface TreatmentTooth {
  id: string;
  plan_id: string;
  tooth: number; // Número FDI (Ex: 11-48, 51-85)
  condition: ToothCondition; // Condição geral do dente
  notes?: string;
  surfaces?: Partial<Record<ToothSurface, ToothCondition>>; // Condição por face/superfície
}

export interface TreatmentProcedure {
  id: string;
  tooth_id: string; // FK do TreatmentTooth
  procedure: string; // Ex: 'CANAL', 'IMPLANTE', 'RESTAURACAO', 'FACETA'
  price: number;
}

export interface LayerState {
  visible: boolean;
  opacity: number;
}

export type LayerKey = 'gums' | 'bone' | 'teeth' | 'roots' | 'pulp' | 'canals' | 'nerves' | 'sinus';

export type LayerConfig = Record<LayerKey, LayerState>;

export interface Viewer3DState {
  activeTooth: number | null;
  viewingAnatomy?: boolean;
  activeSurfaces: ToothSurface[];
  transparencyMode: boolean;
  presentationMode: boolean;
  simulationState: 'BEFORE' | 'AFTER';
  loading: boolean;
  missingTeeth?: number[];
  layers: LayerConfig;
}
