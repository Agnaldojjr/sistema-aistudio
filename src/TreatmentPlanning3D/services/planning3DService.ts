import { TreatmentPlan, TreatmentTooth, TreatmentProcedure } from '../types';

/**
 * Simula a busca de um plano de tratamento ativo para o paciente
 */
export async function getActivePlan(patientId: string): Promise<TreatmentPlan> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        id: `plan-${Date.now()}`,
        patient_id: patientId,
        created_at: new Date().toISOString(),
        status: 'DRAFT',
      });
    }, 500);
  });
}

/**
 * Simula a busca dos dentes associados ao plano
 */
export async function getPlanTeeth(planId: string): Promise<TreatmentTooth[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([]); // Retorna vazio inicialmente para simular uma arcada saudável
    }, 400);
  });
}

/**
 * Simula a busca dos procedimentos associados aos dentes do plano
 */
export async function getPlanProcedures(toothIds: string[]): Promise<TreatmentProcedure[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([]);
    }, 300);
  });
}

/**
 * Simula salvar o plano de tratamento completo no banco de dados
 */
export async function savePlan(
  plan: TreatmentPlan,
  teeth: TreatmentTooth[],
  procedures: TreatmentProcedure[]
): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('[TreatmentPlanning3DService] Plano salvo com sucesso no banco de dados:', {
        plan,
        teeth,
        procedures,
      });
      resolve({ success: true });
    }, 800);
  });
}
