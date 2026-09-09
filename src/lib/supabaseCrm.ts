import { supabase } from './supabase';

// Helper: Pega a sessão atual
async function getUserId() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) throw new Error('Usuário não autenticado no Supabase');
  return session.user.id;
}

export async function getSupabaseCRMDatabase() {
  try {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from('clinic_data')
      .select('crm_data')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao buscar CRM do Supabase:', error);
      throw error;
    }

    if (!data || !data.crm_data) {
      // Contingência: verifica se há backup recente em localStorage com pacientes
      try {
        const localBackup = localStorage.getItem('ag_crm_local_backup');
        if (localBackup) {
          const parsed = JSON.parse(localBackup);
          if (Array.isArray(parsed?.patients) && parsed.patients.length > 0) {
            console.warn('[CRM Shield] Recuperando dados do backup local (Supabase retornou vazio).');
            return parsed;
          }
        }
      } catch (_) {}

      return { patients: [], appointments: [], clinical_history: [], communications: [], anamnese: [], avisos: [], documentos: [], galeria: [], pagamentos: [], tratamentos: [], odontograma: [] };
    }

    // Salva cópia preventiva dos dados válidos retornados
    try {
      if (Array.isArray(data.crm_data?.patients) && data.crm_data.patients.length > 0) {
        localStorage.setItem('ag_crm_local_backup', JSON.stringify(data.crm_data));
      }
    } catch (_) {}

    return data.crm_data;
  } catch (error) {
    console.error('Erro getSupabaseCRMDatabase:', error);
    // Em caso de falha de rede/autenticação, tenta resgatar o backup local antes de retornar vazio
    try {
      const localBackup = localStorage.getItem('ag_crm_local_backup');
      if (localBackup) {
        const parsed = JSON.parse(localBackup);
        if (Array.isArray(parsed?.patients) && parsed.patients.length > 0) {
          console.warn('[CRM Shield] Usando backup local devido a erro na consulta do Supabase.');
          return parsed;
        }
      }
    } catch (_) {}
    return { patients: [], appointments: [], clinical_history: [], communications: [], anamnese: [], avisos: [], documentos: [], galeria: [], pagamentos: [], tratamentos: [], odontograma: [] };
  }
}

export async function saveSupabaseCRMDatabase(dataToSave: any) {
  const userId = await getUserId();
  
  // SAFEGUARD: Prevenir sobrescrita ou perda acidental de dados de pacientes
  let currentData: any = null;
  try {
    currentData = await getSupabaseCRMDatabase();
  } catch (e) {
    console.warn('[CRM Shield] Não foi possível carregar base existente para comparação:', e);
  }

  const currentPatients = Array.isArray(currentData?.patients) ? currentData.patients : [];
  const incomingPatients = dataToSave?.patients;

  // Se o payload a ser salvo não trouxer a lista de pacientes ou trouxer array vazio enquanto já existem pacientes:
  // NUNCA apagar os pacientes existentes! Preserva a lista atual.
  if ((!Array.isArray(incomingPatients) || incomingPatients.length === 0) && currentPatients.length > 0) {
    console.warn('[CRM Shield] Alerta: dataToSave não possui pacientes, preservando os pacientes existentes.');
    dataToSave.patients = currentPatients;
  } else if (Array.isArray(incomingPatients) && currentPatients.length > 5 && incomingPatients.length < currentPatients.length - 2) {
    // Alerta caso mais de 2 pacientes sejam removidos simultaneamente
    const confirmForce = window.confirm(
      `⚠️ ALERTA DE SEGURANÇA (Prevenção de Perda de Dados) ⚠️\n\n` +
      `O banco de dados atual tem ${currentPatients.length} pacientes, mas esta operação tentou salvar apenas ${incomingPatients.length} pacientes.\n\n` +
      `Isso APAGARIA pacientes permanentemente.\n\nDeseja FORÇAR a gravação mesmo perdendo dados?`
    );
    if (!confirmForce) {
      throw new Error(`Gravação abortada por segurança. Tentativa de salvar ${incomingPatients.length} por cima de ${currentPatients.length}.`);
    }
  }

  // Safe Merge: Preservar coleções clínicas irmãs se não forem explicitamente enviadas
  if (currentData) {
    const clinicalCollections = [
      'appointments', 'clinical_history', 'communications',
      'anamnese', 'avisos', 'documentos', 'galeria',
      'pagamentos', 'tratamentos', 'odontograma'
    ];
    for (const key of clinicalCollections) {
      if ((!dataToSave[key] || (Array.isArray(dataToSave[key]) && dataToSave[key].length === 0)) && Array.isArray(currentData[key]) && currentData[key].length > 0) {
        dataToSave[key] = currentData[key];
      }
    }
  }

  // Backup preventivo em localStorage
  try {
    localStorage.setItem('ag_crm_local_backup', JSON.stringify(dataToSave));
  } catch (e) {
    // Silencioso se quota excedida
  }

  let lastError: any = null;

  // 1. Tentar UPDATE direto se a linha do usuário já existir (99% dos casos)
  // O UPDATE não usa ON CONFLICT (não requer UNIQUE constraint) e não dispara regras de INSERT do RLS
  try {
    const { data: existing, error: checkError } = await supabase
      .from('clinic_data')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!checkError && existing) {
      const { error: updateError } = await supabase
        .from('clinic_data')
        .update({
          crm_data: dataToSave,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (!updateError) {
        return; // Sucesso via UPDATE
      }
      console.warn('Tentativa de UPDATE falhou, tentando upsert/insert...', updateError);
      lastError = updateError;
    }
  } catch (err: any) {
    console.warn('Verificação de registro existente falhou:', err);
  }

  // 2. Fallback: tentar UPSERT com onConflict
  const { error: upsertError } = await supabase
    .from('clinic_data')
    .upsert({
      user_id: userId,
      crm_data: dataToSave,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (!upsertError) {
    return; // Sucesso via UPSERT
  }
  lastError = upsertError;

  // 3. Fallback final: INSERT simples (para usuário novo cujo registro ainda não exista)
  const { error: insertError } = await supabase
    .from('clinic_data')
    .insert({
      user_id: userId,
      crm_data: dataToSave,
      updated_at: new Date().toISOString()
    });

  if (!insertError) {
    return; // Sucesso via INSERT
  }
  lastError = insertError;

  // Se todas as tentativas falharem, loga o erro técnico real e lança mensagem com detalhes
  console.error('Erro ao salvar CRM no Supabase:', lastError);
  const detailedMsg = lastError?.message || lastError?.details || lastError?.hint || (typeof lastError === 'object' ? JSON.stringify(lastError) : String(lastError));
  throw new Error(`Falha ao salvar no banco de dados (${detailedMsg})`);
}
