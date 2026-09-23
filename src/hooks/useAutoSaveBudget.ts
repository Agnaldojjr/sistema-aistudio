import { useState, useEffect, useRef, useCallback } from 'react';
import {
  saveBudgetLocally,
  uploadBudgetToCloud,
  BudgetSyncStatus,
  getBudgetDraft
} from '../services/budgetSyncService';
import { TreatmentProposal, PhotoSection, Procedure } from '../types';

export interface UseAutoSaveBudgetProps {
  patientId?: string;
  patientName?: string;
  currentFileId?: string | null;
  setCurrentFileId?: (id: string | null) => void;
  proposal: TreatmentProposal;
  sections: PhotoSection[];
  procedures: Procedure[];
  simulations: any[];
  selectedPlanIndices: number[];
  customNetDesired?: number | null;
  boxEntradas?: number[];
  boxMethods?: string[];
  boxInstallments?: number[];
  debounceCloudMs?: number;
  enabled?: boolean;
}

export function useAutoSaveBudget({
  patientId,
  patientName = 'Paciente',
  currentFileId,
  setCurrentFileId,
  proposal,
  sections,
  procedures,
  simulations,
  selectedPlanIndices,
  customNetDesired,
  boxEntradas,
  boxMethods,
  boxInstallments,
  debounceCloudMs = 2500,
  enabled = true
}: UseAutoSaveBudgetProps) {
  const [syncStatus, setSyncStatus] = useState<BudgetSyncStatus>('idle');
  const [lastSavedLocal, setLastSavedLocal] = useState<Date | null>(null);
  const [lastSyncedCloud, setLastSyncedCloud] = useState<Date | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);

  const cloudTimerRef = useRef<NodeJS.Timeout | null>(null);
  const latestDataRef = useRef<{ jsonStr: string; filename: string; patientId: string } | null>(null);
  const isInitialMount = useRef(true);

  // Calcula o nome do arquivo a ser gravado (opção de rascunho ativo vs arquivo existente)
  const getActiveFilename = useCallback(() => {
    if (currentFileId && currentFileId !== 'NEW_FILE' && currentFileId.includes('.json')) {
      return currentFileId.split('/').pop()!;
    }
    return 'orcamento_ativo.json';
  }, [currentFileId]);

  // Força sincronização imediata com a nuvem (sem aguardar o debounce)
  const forceCloudSync = useCallback(async () => {
    if (!patientId || !enabled) return;

    if (cloudTimerRef.current) {
      clearTimeout(cloudTimerRef.current);
      cloudTimerRef.current = null;
    }

    const filename = getActiveFilename();
    const statePayload = {
      proposal,
      sections,
      procedures,
      simulations,
      selectedPlanIndices,
      customNetDesired,
      boxEntradas,
      boxMethods,
      boxInstallments
    };

    // 1. Garante salvamento local prévio
    const { jsonStr, timestamp } = saveBudgetLocally(patientId, patientName, filename, statePayload);
    setLastSavedLocal(new Date(timestamp));

    // 2. Dispara upload imediato para o Supabase
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    setSyncStatus('syncing_cloud');
    setCloudError(null);

    const res = await uploadBudgetToCloud(patientId, filename, jsonStr);
    if (res.success) {
      setSyncStatus('synced_cloud');
      setLastSyncedCloud(new Date());
    } else {
      setSyncStatus('error');
      setCloudError(res.error?.message || 'Erro ao sincronizar com a nuvem');
    }
  }, [
    patientId,
    patientName,
    enabled,
    getActiveFilename,
    proposal,
    sections,
    procedures,
    simulations,
    selectedPlanIndices,
    customNetDesired,
    boxEntradas,
    boxMethods,
    boxInstallments
  ]);

  // Cria uma versão permanente fechada (ex: orcamento_v{timestamp}.json)
  const sealPermanentVersion = useCallback(async (customLabel?: string) => {
    if (!patientId) return null;

    let versionFilename = `orcamento_v${Date.now()}.json`;
    if (customLabel) {
      const safeLabel = customLabel.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      versionFilename = `orcamento_${safeLabel}_${Date.now()}.json`;
    }

    const statePayload = {
      proposal,
      sections,
      procedures,
      simulations,
      selectedPlanIndices,
      customNetDesired,
      boxEntradas,
      boxMethods,
      boxInstallments
    };

    // Salva local e sobe para o Supabase
    const { jsonStr } = saveBudgetLocally(patientId, patientName, versionFilename, statePayload);
    setSyncStatus('syncing_cloud');

    const res = await uploadBudgetToCloud(patientId, versionFilename, jsonStr);
    if (res.success) {
      setSyncStatus('synced_cloud');
      setLastSyncedCloud(new Date());
      if (setCurrentFileId) {
        setCurrentFileId(`Orcamentos/${versionFilename}`);
      }
      return versionFilename;
    } else {
      setSyncStatus('error');
      return null;
    }
  }, [
    patientId,
    patientName,
    proposal,
    sections,
    procedures,
    simulations,
    selectedPlanIndices,
    customNetDesired,
    boxEntradas,
    boxMethods,
    boxInstallments,
    setCurrentFileId
  ]);

  // Efeito principal: auto-salvamento a cada alteração
  useEffect(() => {
    // Pula o primeiro frame para evitar salvar antes do carregamento inicial dos dados do paciente
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!patientId || !enabled) return;

    const filename = getActiveFilename();
    const statePayload = {
      proposal,
      sections,
      procedures,
      simulations,
      selectedPlanIndices,
      customNetDesired,
      boxEntradas,
      boxMethods,
      boxInstallments
    };

    // 🚀 PASSO 1: Salvamento LOCAL IMEDIATO (0s)
    const { jsonStr, timestamp } = saveBudgetLocally(patientId, patientName, filename, statePayload);
    setSyncStatus('saved_local');
    setLastSavedLocal(new Date(timestamp));
    latestDataRef.current = { jsonStr, filename, patientId };

    // ☁️ PASSO 2: Agendamento do Upload para a Nuvem com Debounce
    if (cloudTimerRef.current) {
      clearTimeout(cloudTimerRef.current);
    }

    cloudTimerRef.current = setTimeout(async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncStatus('offline');
        return;
      }

      setSyncStatus('syncing_cloud');
      setCloudError(null);

      const res = await uploadBudgetToCloud(patientId, filename, jsonStr);
      if (res.success) {
        setSyncStatus('synced_cloud');
        setLastSyncedCloud(new Date());
      } else {
        setSyncStatus('error');
        setCloudError(res.error?.message || 'Erro ao salvar na nuvem');
      }
    }, debounceCloudMs);

    return () => {
      if (cloudTimerRef.current) {
        clearTimeout(cloudTimerRef.current);
      }
    };
  }, [
    patientId,
    patientName,
    enabled,
    getActiveFilename,
    proposal,
    sections,
    procedures,
    simulations,
    selectedPlanIndices,
    customNetDesired,
    boxEntradas,
    boxMethods,
    boxInstallments,
    debounceCloudMs
  ]);

  // Flush ao descarregar a página ou fechar a aba
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (latestDataRef.current) {
        const { patientId: pId, filename, jsonStr } = latestDataRef.current;
        // Garante que o estado local mais recente esteja gravado no disco
        saveBudgetLocally(pId, patientName, filename, JSON.parse(jsonStr));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [patientName]);

  return {
    syncStatus,
    lastSavedLocal,
    lastSyncedCloud,
    cloudError,
    forceCloudSync,
    sealPermanentVersion
  };
}
