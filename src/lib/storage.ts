import { supabase } from './supabase';
import { uploadFile, getFileUrl, deleteFile, listFiles, moveFile, bucketName } from './r2';

/**
 * Função utilitária para garantir um formato seguro de nome de pasta
 */
function getSafePatientPath(patientName: string) {
  return (patientName || 'Anonimo').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_');
}

/**
 * Função utilitária para garantir um formato seguro de nome de arquivo
 */
function getSafeFilename(filename: string): string {
  if (filename.includes('/')) return filename;
  const safeFilename = filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-.]/g, '');
  return safeFilename || 'arquivo_sem_nome';
}

/**
 * Faz o upload de um arquivo para o bucket R2
 */
export async function uploadPatientFileToSupabase(patientIdentifier: string, file: File | Blob, filename: string, subfolder?: string) {
  const { data: { session }, error: authErr } = await supabase.auth.getSession();
  if (authErr || !session) throw new Error('Usuário não autenticado');
  
  const userId = session.user.id;
  const targetFolder = getSafePatientPath(patientIdentifier);
  const subfolderPath = subfolder ? `${subfolder.replace(/^\/|\/$/g, '')}/` : '';
  
  const finalFilename = getSafeFilename(filename);
  const filePath = filename.includes('/') ? filename : `${userId}/${targetFolder}/${subfolderPath}${finalFilename}`;

  try {
    await uploadFile(file, filePath);
    return { path: filePath };
  } catch (error) {
    console.error('Erro ao fazer upload para o Cloudflare R2:', error);
    throw error;
  }
}

/**
 * Lista todos os arquivos de um paciente (incluindo subpastas se aplicável)
 */
export async function listPatientFilesFromSupabase(patientId: string, fallbackPatientName?: string, subfolder?: string) {
  const { data: { session }, error: authErr } = await supabase.auth.getSession();
  if (authErr || !session) throw new Error('Usuário não autenticado');
  
  const userId = session.user.id;
  const idPath = getSafePatientPath(patientId);
  const basePath = `${userId}/${idPath}`;
  let path = subfolder ? `${basePath}/${subfolder.replace(/^\/|\/$/g, '')}/` : `${basePath}/`;

  const fetchFilesInPath = async (targetPath: string, subPrefix: string = '') => {
    try {
      // Ensure targetPath ends with / for prefix search
      const prefix = targetPath.endsWith('/') ? targetPath : `${targetPath}/`;
      const files = await listFiles(prefix);
      
      return files
        .filter(f => f.Key && !f.Key.endsWith('.emptyFolderPlaceholder'))
        .map(f => {
          const nameParts = f.Key!.split('/');
          const name = nameParts[nameParts.length - 1];
          return {
            name: name,
            storagePath: f.Key!,
            displayName: subPrefix ? `${subPrefix}/${name}` : name,
            subfolder: subPrefix || undefined,
            created_at: f.LastModified?.toISOString() || new Date().toISOString(),
            updated_at: f.LastModified?.toISOString() || new Date().toISOString(),
          };
        });
    } catch (e) {
      console.error('Error listing R2 files:', e);
      return [];
    }
  };

  let rawFiles = await fetchFilesInPath(path, subfolder || '');

  if (!subfolder) {
    const subfolderFiles = await fetchFilesInPath(`${basePath}/Orcamentos/`, 'Orcamentos');
    rawFiles = [...rawFiles, ...subfolderFiles];
  }

  // --- TELEMETRY FALLBACK ---
  if (fallbackPatientName) {
    const legacyFolder = getSafePatientPath(fallbackPatientName);
    if (legacyFolder !== idPath) {
      const legacyBasePath = `${userId}/${legacyFolder}`;
      const legacyPath = subfolder ? `${legacyBasePath}/${subfolder.replace(/^\/|\/$/g, '')}/` : `${legacyBasePath}/`;
      
      let fallbackFiles = await fetchFilesInPath(legacyPath, subfolder || '');
      if (!subfolder) {
        const fallbackSub = await fetchFilesInPath(`${legacyBasePath}/Orcamentos/`, 'Orcamentos');
        fallbackFiles = [...fallbackFiles, ...fallbackSub];
      }
      
      if (fallbackFiles.length > 0) {
        console.warn(`[TELEMETRIA-MIGRACAO] Fallback acionado para R2.`);
        
        // Deduplicar
        const existingKeys = new Set(rawFiles.map(f => f.storagePath.replace(`${userId}/${idPath}/`, '')));
        const uniqueFallback = fallbackFiles.filter(f => {
          const legacyKey = f.storagePath.replace(`${userId}/${legacyFolder}/`, '');
          return !existingKeys.has(legacyKey);
        });
        
        rawFiles = [...rawFiles, ...uniqueFallback];
      }
    }
  }

      // --- ROOT UPLOAD FALLBACK ---
    if (rawFiles.length === 0) {
      const rootBasePath = `${idPath}`;
      const rootPath = subfolder ? `${rootBasePath}/${subfolder.replace(/^\/|\/$/g, '')}/` : `${rootBasePath}/`;
      let rootFiles = await fetchFilesInPath(rootPath, subfolder || '');
      if (!subfolder) {
        const rootSub = await fetchFilesInPath(`${rootBasePath}/Orcamentos/`, 'Orcamentos');
        rootFiles = [...rootFiles, ...rootSub];
      }
      if (rootFiles.length > 0) { rawFiles = rootFiles; }
    }

    if (rawFiles.length > 0) {
    const fileObjects = await Promise.all(rawFiles.map(async (f) => {
      let thumbnailLink = null;
      try {
        thumbnailLink = await getFileUrl(f.storagePath, 3600);
      } catch (e) {
        console.error('Erro ao gerar URL assinada:', e);
      }
      
      return {
        id: f.storagePath,
        name: f.displayName,
        thumbnailLink,
        createdTime: f.created_at,
        modifiedTime: f.updated_at,
        mimeType: f.name.endsWith('.pdf') ? 'application/pdf' : f.name.endsWith('.json') ? 'application/json' : 'application/octet-stream',
        subfolder: f.subfolder
      };
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
              },
              content: fileData
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

  // TELEMETRIA: Se chegou aqui, retornou 0 arquivos
  try {
    const errorLog = JSON.stringify({
      patientId, fallbackPatientName, idPath, userId, msg: "Zero files found for both paths (R2)"
    });
    const blob = new Blob([errorLog], { type: 'application/json' });
    await uploadFile(blob, `${userId}/telemetry_logs_${Date.now()}_${idPath}.json`);
  } catch(e) {}

  return [];
}

/**
 * Deleta um arquivo específico do paciente no R2
 */
export async function deletePatientFileFromSupabase(patientIdentifier: string, filename: string, subfolder?: string) {
  const { data: { session }, error: authErr } = await supabase.auth.getSession();
  if (authErr || !session) throw new Error('Usuário não autenticado');
  
  const userId = session.user.id;
  const targetFolder = getSafePatientPath(patientIdentifier);
  const subfolderPath = subfolder ? `${subfolder.replace(/^\/|\/$/g, '')}/` : '';
  const finalFilename = getSafeFilename(filename);

  let filePath: string;
  if (filename.startsWith(`${userId}/`)) {
    filePath = filename;
  } else if (filename.includes('/')) {
    filePath = `${userId}/${targetFolder}/${filename.replace(/^\/+/, '')}`;
  } else {
    filePath = `${userId}/${targetFolder}/${subfolderPath}${finalFilename}`;
  }

  try {
    await deleteFile(filePath);
  } catch (error) {
    if (!subfolder && !filename.includes('/')) {
      const fallbackPath = `${userId}/${targetFolder}/Orcamentos/${finalFilename}`;
      try {
        await deleteFile(fallbackPath);
        return;
      } catch (fallbackError) {
        console.error('Erro no fallback delete:', fallbackError);
      }
    }
    console.error('Erro ao deletar arquivo no R2:', error);
    throw error;
  }
}

/**
 * Baixa um arquivo e converte para Data URL
 */
export async function downloadFileAsDataUrlFromSupabase(filePath: string): Promise<string> {
  const url = await getFileUrl(filePath, 60);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Erro ao baixar arquivo do R2');
  }
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function getPatientFileUrlFromSupabase(patientIdentifier: string, filename: string, expiresIn: number = 3600, subfolder?: string) {
  const { data: { session }, error: authErr } = await supabase.auth.getSession();
  if (authErr || !session) throw new Error('Usuário não autenticado');
  
  const userId = session.user.id;
  const targetFolder = getSafePatientPath(patientIdentifier);
  const subfolderPath = subfolder ? `${subfolder.replace(/^\/|\/$/g, '')}/` : '';
  const finalFilename = getSafeFilename(filename);
  
  const filePath = filename.startsWith(`${userId}/`)
    ? filename
    : (filename.includes('/')
      ? `${userId}/${targetFolder}/${filename.replace(/^\/+/, '')}`
      : `${userId}/${targetFolder}/${subfolderPath}${finalFilename}`);

  try {
    return await getFileUrl(filePath, expiresIn);
  } catch (error: any) {
    console.warn('Aviso ao obter URL do R2:', error.message || error);
    return null;
  }
}

export async function renamePatientFileInSupabase(patientIdentifier: string, oldFilename: string, newFilename: string, subfolder?: string) {
  const { data: { session }, error: authErr } = await supabase.auth.getSession();
  if (authErr || !session) throw new Error('Usuário não autenticado');
  
  const userId = session.user.id;
  const targetFolder = getSafePatientPath(patientIdentifier);
  const subfolderPath = subfolder ? `${subfolder.replace(/^\/|\/$/g, '')}/` : '';
  const safeNewBaseName = getSafeFilename(newFilename.split('/').pop() || newFilename);
  
  let oldPath: string;
  let newPath: string;

  if (oldFilename.startsWith(`${userId}/`)) {
    oldPath = oldFilename;
    const parentDir = oldPath.substring(0, oldPath.lastIndexOf('/'));
    newPath = `${parentDir}/${safeNewBaseName}`;
  } else if (oldFilename.includes('/')) {
    const cleanOld = oldFilename.replace(/^\/+/, '');
    oldPath = `${userId}/${targetFolder}/${cleanOld}`;
    const parentDir = oldPath.substring(0, oldPath.lastIndexOf('/'));
    newPath = `${parentDir}/${safeNewBaseName}`;
  } else {
    const finalOldFilename = getSafeFilename(oldFilename);
    oldPath = `${userId}/${targetFolder}/${subfolderPath}${finalOldFilename}`;
    newPath = `${userId}/${targetFolder}/${subfolderPath}${safeNewBaseName}`;
  }

  if (oldPath === newPath) return;

  try {
    await moveFile(oldPath, newPath);
  } catch (error) {
    if (!oldFilename.includes('Orcamentos') && !subfolder) {
      const fallbackOld = `${userId}/${targetFolder}/Orcamentos/${getSafeFilename(oldFilename)}`;
      const fallbackNew = `${userId}/${targetFolder}/Orcamentos/${safeNewBaseName}`;
      try {
        await moveFile(fallbackOld, fallbackNew);
        return;
      } catch (fallbackError) {
        console.error('Erro fallback move R2:', fallbackError);
      }
    }
    console.error('Erro ao renomear arquivo no R2:', error);
    throw error;
  }
}
