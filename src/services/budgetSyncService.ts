import { uploadPatientFileToSupabase } from '../lib/supabaseStorage';

export type BudgetSyncStatus = 
  | 'idle'
  | 'saving_local'
  | 'saved_local'
  | 'syncing_cloud'
  | 'synced_cloud'
  | 'offline'
  | 'error';

export interface BudgetDraftState {
  patientId: string;
  patientName: string;
  fileId: string;
  timestamp: number;
  data: {
    proposal: any;
    sections: any[];
    procedures: any[];
    simulations: any[];
    selectedPlanIndices: number[];
    customNetDesired?: number | null;
    boxEntradas?: number[];
    boxMethods?: string[];
    boxInstallments?: number[];
  };
}

export interface OfflineBudgetItem {
  id: string; // ex: 'orcamento_ativo.json' ou 'orcamento_v1.json'
  patientId: string;
  patientName: string;
  data: string; // JSON serializado
  timestamp: number;
}

const OFFLINE_QUEUE_KEY = 'ag_offline_budgets';
const DRAFT_PREFIX = 'ag_budget_draft_';

/**
 * Retorna a fila de orçamentos pendentes de sincronização
 */
export function getOfflineQueue(): OfflineBudgetItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('[budgetSyncService] Erro ao ler fila offline de orçamentos:', err);
    return [];
  }
}

/**
 * Salva a fila offline no LocalStorage
 */
export function saveOfflineQueue(queue: OfflineBudgetItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new Event('local-storage'));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.warn('[budgetSyncService] Erro ao gravar fila offline de orçamentos:', err);
  }
}

/**
 * Recupera o último rascunho salvo localmente para determinado paciente
 */
export function getBudgetDraft(patientId: string): BudgetDraftState | null {
  if (typeof window === 'undefined' || !patientId) return null;
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${patientId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn(`[budgetSyncService] Erro ao recuperar rascunho de ${patientId}:`, err);
    return null;
  }
}

/**
 * Limpa o rascunho salvo localmente de um paciente
 */
export function clearBudgetDraft(patientId: string): void {
  if (typeof window === 'undefined' || !patientId) return;
  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${patientId}`);
  } catch (err) {
    console.warn(`[budgetSyncService] Erro ao limpar rascunho de ${patientId}:`, err);
  }
}

/**
 * Salva o orçamento imediatamente no armazenamento local (0s de delay)
 * e o insere na fila de sincronização em nuvem.
 */
export function saveBudgetLocally(
  patientId: string,
  patientName: string,
  filename: string,
  state: BudgetDraftState['data']
): { jsonStr: string; timestamp: number } {
  const timestamp = Date.now();
  const cleanFilename = filename.includes('/') ? filename.split('/').pop()! : filename;

  const draft: BudgetDraftState = {
    patientId,
    patientName,
    fileId: cleanFilename,
    timestamp,
    data: state
  };

  const jsonStr = JSON.stringify(state);

  // 1. Salva o rascunho local instantâneo do paciente
  try {
    localStorage.setItem(`${DRAFT_PREFIX}${patientId}`, JSON.stringify(draft));
  } catch (e) {
    console.warn('[budgetSyncService] Falha ao gravar rascunho individual:', e);
  }

  // 2. Registra na fila persistente ag_offline_budgets
  const queue = getOfflineQueue();
  const existingIdx = queue.findIndex(q => q.id === cleanFilename && q.patientId === patientId);
  const queueItem: OfflineBudgetItem = {
    id: cleanFilename,
    patientId,
    patientName,
    data: jsonStr,
    timestamp
  };

  if (existingIdx > -1) {
    queue[existingIdx] = queueItem;
  } else {
    queue.push(queueItem);
  }
  saveOfflineQueue(queue);

  // 3. Notifica a aplicação do salvamento local imediato
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ag-budget-saved-local', {
      detail: { patientId, filename: cleanFilename, timestamp }
    }));
  }

  return { jsonStr, timestamp };
}

/**
 * Envia o orçamento diretamente para a nuvem (Supabase Storage)
 */
export async function uploadBudgetToCloud(
  patientId: string,
  filename: string,
  jsonStr: string
): Promise<{ success: boolean; error?: any }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: false, error: new Error('Dispositivo sem conexão de internet (offline)') };
  }

  const cleanFilename = filename.includes('/') ? filename.split('/').pop()! : filename;

  try {
    const fileBlob = new Blob([jsonStr], { type: 'application/json' });
    await uploadPatientFileToSupabase(patientId, fileBlob, cleanFilename, 'Orcamentos');
    
    // Remove este item da fila offline de pendências se estiver nela
    const queue = getOfflineQueue();
    const updatedQueue = queue.filter(
      q => !(q.id === cleanFilename && q.patientId === patientId)
    );
    saveOfflineQueue(updatedQueue);

    // Dispara evento de sucesso de sincronização com o Supabase
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ag-budget-synced', {
        detail: { patientId, filename: cleanFilename, timestamp: Date.now() }
      }));
    }

    return { success: true };
  } catch (err: any) {
    console.warn(`[budgetSyncService] Falha ao enviar ${cleanFilename} para o Supabase:`, err);
    return { success: false, error: err };
  }
}

/**
 * Processa e envia todos os orçamentos pendentes na fila offline
 */
let isSyncingQueue = false;

export async function syncAllPendingBudgets(): Promise<{ synced: number; failed: number }> {
  if (isSyncingQueue) return { synced: 0, failed: 0 };
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { synced: 0, failed: 0 };

  isSyncingQueue = true;
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    isSyncingQueue = false;
    return { synced: 0, failed: 0 };
  }

  let syncedCount = 0;
  let failedCount = 0;
  const remaining: OfflineBudgetItem[] = [];

  for (const item of queue) {
    try {
      const fileBlob = new Blob([item.data], { type: 'application/json' });
      const cleanFilename = item.id.includes('/') ? item.id.split('/').pop()! : item.id;
      await uploadPatientFileToSupabase(item.patientId || item.patientName, fileBlob, cleanFilename, 'Orcamentos');
      syncedCount++;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ag-budget-synced', {
          detail: { patientId: item.patientId, filename: cleanFilename, timestamp: Date.now() }
        }));
      }
    } catch (err) {
      console.warn(`[budgetSyncService] ⏳ Mantendo ${item.id} na fila offline:`, err);
      failedCount++;
      remaining.push(item);
    }
  }

  saveOfflineQueue(remaining);
  isSyncingQueue = false;
  return { synced: syncedCount, failed: failedCount };
}

// Inicializa o ouvinte de reconexão de internet no navegador
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[budgetSyncService] 🌐 Conexão restaurada! Sincronizando orçamentos pendentes...');
    syncAllPendingBudgets();
  });
}
