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

    // Retorna a base vazia se não existir ainda (PGRST116 = não encontrado)
    if (!data || !data.crm_data) {
      return { patients: [], appointments: [], clinical_history: [], communications: [], anamnese: [], avisos: [], documentos: [], galeria: [], pagamentos: [], tratamentos: [], odontograma: [] };
    }

    return data.crm_data;
  } catch (error) {
    console.error('Erro getSupabaseCRMDatabase:', error);
    return { patients: [], appointments: [], clinical_history: [], communications: [], anamnese: [], avisos: [], documentos: [], galeria: [], pagamentos: [], tratamentos: [], odontograma: [] };
  }
}

export async function saveSupabaseCRMDatabase(dataToSave: any) {
  const userId = await getUserId();
  
  // Safeguard: Prevenir deleção em massa acidental
  try {
    const currentData = await getSupabaseCRMDatabase();
    const currentCount = currentData?.patients?.length || 0;
    const newCount = dataToSave?.patients?.length || 0;
    
    // Se o banco atual tem dados e estamos perdendo mais de 2 pacientes de uma vez
    if (currentCount > 5 && newCount < currentCount - 2) {
      const confirmForce = window.confirm(
        `⚠️ ALERTA DE SEGURANÇA (Prevenção de Perda de Dados) ⚠️\n\n` +
        `O banco de dados atual tem ${currentCount} pacientes, mas esta operação tentou salvar apenas ${newCount} pacientes.\n\n` +
        `Isso APAGARIA pacientes permanentemente.\n\nDeseja FORÇAR a gravação mesmo perdendo dados?`
      );
      if (!confirmForce) {
        throw new Error(`Gravação abortada por segurança. Tentativa de salvar ${newCount} por cima de ${currentCount}.`);
      }
    }
  } catch (e: any) {
    if (e.message.includes('abortada por segurança')) throw e;
    // Se houver outro erro (ex: offline), ignorar a checagem e seguir
  }

  const { error } = await supabase
    .from('clinic_data')
    .upsert({
      user_id: userId,
      crm_data: dataToSave,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('Erro ao salvar CRM no Supabase:', error);
    throw new Error('Falha ao salvar no banco de dados');
  }
}
