import { supabase } from './supabase';

const BUCKET_NAME = 'patient_files';

/**
 * Função utilitária para garantir um formato seguro de nome de pasta
 */
function getSafePatientPath(patientName: string) {
  return (patientName || 'Anonimo').replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_');
}

/**
 * Faz o upload de um arquivo para o bucket do Supabase
 */
export async function uploadPatientFileToSupabase(patientName: string, file: File | Blob, filename: string) {
  const { data: { session }, error: authErr } = await supabase.auth.getSession();
  if (authErr || !session) throw new Error('Usuário não autenticado');
  
  const userId = session.user.id;
  const patientFolder = getSafePatientPath(patientName);
  const filePath = `${userId}/${patientFolder}/${filename}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      upsert: true
    });

  if (error) {
    console.error('Erro ao fazer upload para o Supabase Storage:', error);
    throw error;
  }

  return data;
}

/**
 * Lista todos os arquivos de um paciente
 */
export async function listPatientFilesFromSupabase(patientName: string) {
  const { data: { session }, error: authErr } = await supabase.auth.getSession();
  if (authErr || !session) throw new Error('Usuário não autenticado');
  
  const userId = session.user.id;
  const patientFolder = getSafePatientPath(patientName);
  const path = `${userId}/${patientFolder}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(path);

  if (error) {
    console.error('Erro ao listar arquivos do Supabase Storage:', error);
    return [];
  }

  // Se o bucket for privado, precisamos gerar URLs assinadas para baixar ou exibir na galeria
  if (data && data.length > 0) {
    const filePaths = data.filter(f => f.name !== '.emptyFolderPlaceholder').map(f => `${path}/${f.name}`);
    
    // Gerar URLs assinadas válidas por 1 hora
    const { data: signedUrlsData, error: signedUrlsError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrls(filePaths, 3600);

    if (signedUrlsError) {
      console.error('Erro ao gerar URLs assinadas:', signedUrlsError);
    } else {
      const fileObjects = data
        .filter(f => f.name !== '.emptyFolderPlaceholder')
        .map((f, i) => ({
          id: `${path}/${f.name}`,
          name: f.name,
          thumbnailLink: signedUrlsData?.[i]?.signedUrl || null, // Funciona como thumbnail (url temporária)
          createdTime: f.created_at,
          modifiedTime: f.updated_at || f.created_at,
          mimeType: f.metadata?.mimetype || 'application/octet-stream'
        }));

      const enrichedFiles = await Promise.all(fileObjects.map(async (file) => {
        if (file.name.toLowerCase().endsWith('.json') && file.thumbnailLink) {
          try {
            const r = await fetch(file.thumbnailLink);
            if (r.ok) {
              const fileData = await r.json();
              
              let total = 0;
              if (fileData.simulations && fileData.selectedPlanIndex !== undefined && fileData.simulations[fileData.selectedPlanIndex]) {
                total = fileData.simulations[fileData.selectedPlanIndex].custoTotal;
              } else {
                const sections = fileData.sections || [];
                const procedures = fileData.procedures || [];
                sections.forEach((sec: any) => {
                  sec.markers?.forEach((marker: any) => {
                    if (marker.procedureInstances && marker.procedureInstances.length > 0) {
                      marker.procedureInstances.forEach((inst: any) => {
                        total += (inst.includeFinancial !== false ? (inst.price || 0) : 0);
                      });
                    } else if (marker.procedures) {
                      marker.procedures.forEach((pid: any) => {
                        const proc = procedures.find((p: any) => p.id === pid);
                        total += (proc ? (proc.price || 0) : 0);
                      });
                    }
                  });
                });
              }

              return {
                ...file,
                appProperties: {
                  status: fileData.proposal?.status || 'Aberto',
                  total: total
                }
              };
            }
          } catch (e) {
            console.warn("Failed to fetch/parse JSON content for", file.name, e);
          }
        }
        return file;
      }));

      return enrichedFiles;
    }
  }

  return [];
}

/**
 * Deleta um arquivo específico do paciente
 */
export async function deletePatientFileFromSupabase(patientName: string, filename: string) {
  const { data: { session }, error: authErr } = await supabase.auth.getSession();
  if (authErr || !session) throw new Error('Usuário não autenticado');
  
  const userId = session.user.id;
  const patientFolder = getSafePatientPath(patientName);
  const filePath = filename.includes('/') ? filename : `${userId}/${patientFolder}/${filename}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath]);

  if (error) {
    console.error('Erro ao deletar arquivo:', error);
    throw error;
  }
}

/**
 * Baixa um arquivo e converte para Data URL (útil para Canvas/Edição)
 */
export async function downloadFileAsDataUrlFromSupabase(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(filePath);

  if (error) {
    throw error;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(data);
  });
}


export async function getPatientFileUrlFromSupabase(patientName: string, filename: string, expiresIn: number = 3600) {
  const { data: { session }, error: authErr } = await supabase.auth.getSession();
  if (authErr || !session) throw new Error('Usuário não autenticado');
  
  const userId = session.user.id;
  const patientFolder = getSafePatientPath(patientName);
  const filePath = filename.includes('/') ? filename : `${userId}/${patientFolder}/${filename}`;

  const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(filePath, expiresIn);
  if (error) {
    console.error('Erro ao obter URL:', error);
    return null;
  }
  return data?.signedUrl;
}

export async function renamePatientFileInSupabase(patientName: string, oldFilename: string, newFilename: string) {
  const { data: { session }, error: authErr } = await supabase.auth.getSession();
  if (authErr || !session) throw new Error('Usuário não autenticado');
  
  const userId = session.user.id;
  const patientFolder = getSafePatientPath(patientName);
  const oldPath = oldFilename.includes('/') ? oldFilename : `${userId}/${patientFolder}/${oldFilename}`;
  const newPath = newFilename.includes('/') ? newFilename : `${userId}/${patientFolder}/${newFilename}`;

  const { error } = await supabase.storage.from(BUCKET_NAME).move(oldPath, newPath);
  if (error) {
    console.error('Erro ao renomear arquivo:', error);
    throw error;
  }
}
