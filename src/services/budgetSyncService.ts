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

// IndexedDB para armazenamento robusto de orçamentos completos (sem limites de quota de 5MB)
const IDB_NAME = 'agnaldo_dental_offline_v1';
const IDB_STORE = 'offline_budgets';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB não suportado'));
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'storageKey' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveToIndexedDB(storageKey: string, item: OfflineBudgetItem): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put({ ...item, storageKey });
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve(); // fail silently
    });
  } catch (err) {
    console.warn('[budgetSyncService] Aviso ao salvar no IndexedDB:', err);
  }
}

async function getFromIndexedDB(storageKey: string): Promise<OfflineBudgetItem | null> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(storageKey);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function deleteFromIndexedDB(storageKey: string): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(storageKey);
  } catch {}
}

/**
 * Sanitiza o estado para o LocalStorage:
 * Remove fotos base64 gigantes (>50KB) das seções do odontograma para que o JSON
 * ocupe apenas ~15KB em vez de 5MB+, impedindo o erro 'exceeded the quota'.
 */
export function sanitizeStateForLocalStorage(state: any): any {
  if (!state || typeof state !== 'object') return state;
  try {
    const clone = JSON.parse(JSON.stringify(state));
    if (Array.isArray(clone.sections)) {
      clone.sections = clone.sections.map((sec: any) => {
        if (sec && sec.image && typeof sec.image === 'string' && sec.image.length > 50000) {
          return {
            ...sec,
            image: sec.image.startsWith('data:') ? null : sec.image
          };
        }
        return sec;
      });
    }
    return clone;
  } catch {
    return state;
  }
}

/**
 * Grava de forma segura no LocalStorage com proteção anti-estouro de cota
 */
function safeSetLocalStorage(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    if (
      err &&
      (err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err.code === 22 ||
        err.code === 1014 ||
        err.number === -2147024882)
    ) {
      console.warn(`[budgetSyncService] ⚠️ Quota do LocalStorage excedida para ${key}. Executando limpeza automática de contingência...`);
      try {
        // Reduz a fila ag_offline_budgets mantendo apenas o último registro sanitizado
        const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
        if (raw) {
          const queue = JSON.parse(raw);
          if (Array.isArray(queue)) {
            const trimmed = queue.slice(-1).map((item: any) => {
              try {
                const parsed = JSON.parse(item.data);
                return { ...item, data: JSON.stringify(sanitizeStateForLocalStorage(parsed)) };
              } catch {
                return item;
              }
            });
            localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(trimmed));
          }
        }
      } catch {
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
      }

      // Tenta gravar novamente após a limpeza
      try {
        localStorage.setItem(key, value);
        return true;
      } catch {
        console.warn(`[budgetSyncService] LocalStorage ainda indisponível. Dados salvos com segurança no IndexedDB.`);
        return false;
      }
    }
    return false;
  }
}

/**
 * Limpa qualquer resquício de dados inflados em ag_offline_budgets na inicialização
 */
function cleanupBloatedStorageOnStart(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return;

    // Se o valor armazenado passar de 250KB, sanitiza imediatamente
    if (raw.length > 250000) {
      console.log('[budgetSyncService] 🧹 Otimizando ag_offline_budgets no LocalStorage para liberar cota...');
      const queue = JSON.parse(raw);
      if (Array.isArray(queue)) {
        const sanitized = queue.slice(-3).map((item: any) => {
          try {
            const parsed = JSON.parse(item.data);
            return {
              ...item,
              data: JSON.stringify(sanitizeStateForLocalStorage(parsed))
            };
          } catch {
            return item;
          }
        });
        safeSetLocalStorage(OFFLINE_QUEUE_KEY, JSON.stringify(sanitized));
      }
    }
  } catch (e) {
    try {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    } catch {}
  }
}

cleanupBloatedStorageOnStart();

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
 * Salva a fila offline no LocalStorage de forma segura
 */
export function saveOfflineQueue(queue: OfflineBudgetItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    safeSetLocalStorage(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
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
 * usando IndexedDB (para dados completos) e LocalStorage sanitizado (anti-quota).
 */
export function saveBudgetLocally(
  patientId: string,
  patientName: string,
  filename: string,
  state: BudgetDraftState['data']
): { jsonStr: string; timestamp: number } {
  const timestamp = Date.now();
  const cleanFilename = filename.includes('/') ? filename.split('/').pop()! : filename;
  const storageKey = `${patientId}::${cleanFilename}`;

  // 1. JSON completo (para upload em nuvem e IndexedDB)
  const fullJsonStr = JSON.stringify(state);

  // 2. JSON sanitizado leve (sem fotos base64 gigantes, ~15KB) para o LocalStorage
  const sanitizedState = sanitizeStateForLocalStorage(state);
  const sanitizedJsonStr = JSON.stringify(sanitizedState);

  const draft: BudgetDraftState = {
    patientId,
    patientName,
    fileId: cleanFilename,
    timestamp,
    data: sanitizedState
  };

  // 3. Salva no IndexedDB (capacidade em gigabytes, imune a QuotaExceededError)
  const fullQueueItem: OfflineBudgetItem = {
    id: cleanFilename,
    patientId,
    patientName,
    data: fullJsonStr,
    timestamp
  };
  saveToIndexedDB(storageKey, fullQueueItem).catch(console.warn);

  // 4. Salva rascunho individual leve no LocalStorage
  safeSetLocalStorage(`${DRAFT_PREFIX}${patientId}`, JSON.stringify(draft));

  // 5. Registra na fila persistente ag_offline_budgets (versão leve sanitizada)
  const queue = getOfflineQueue();
  const existingIdx = queue.findIndex(q => q.id === cleanFilename && q.patientId === patientId);
  const queueItemLight: OfflineBudgetItem = {
    id: cleanFilename,
    patientId,
    patientName,
    data: sanitizedJsonStr,
    timestamp
  };

  if (existingIdx > -1) {
    queue[existingIdx] = queueItemLight;
  } else {
    queue.push(queueItemLight);
  }
  saveOfflineQueue(queue);

  // 6. Notifica a aplicação do salvamento local imediato
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ag-budget-saved-local', {
      detail: { patientId, filename: cleanFilename, timestamp }
    }));
  }

  return { jsonStr: fullJsonStr, timestamp };
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
  const storageKey = `${patientId}::${cleanFilename}`;

  try {
    // Tenta obter o JSON completo do IndexedDB caso o fornecido tenha sido sanitizado
    const idbItem = await getFromIndexedDB(storageKey);
    const finalPayload = idbItem?.data || jsonStr;

    const fileBlob = new Blob([finalPayload], { type: 'application/json' });
    await uploadPatientFileToSupabase(patientId, fileBlob, cleanFilename, 'Orcamentos');
    
    // Remove este item da fila offline e do IndexedDB
    deleteFromIndexedDB(storageKey).catch(() => {});
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
      const cleanFilename = item.id.includes('/') ? item.id.split('/').pop()! : item.id;
      const storageKey = `${item.patientId || item.patientName}::${cleanFilename}`;
      
      const idbItem = await getFromIndexedDB(storageKey);
      const payload = idbItem?.data || item.data;

      const fileBlob = new Blob([payload], { type: 'application/json' });
      await uploadPatientFileToSupabase(item.patientId || item.patientName, fileBlob, cleanFilename, 'Orcamentos');
      
      deleteFromIndexedDB(storageKey).catch(() => {});
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
