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
