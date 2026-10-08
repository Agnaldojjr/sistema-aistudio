import { supabase } from './supabase';
import { uploadFile, getFileUrl, deleteFile, listFiles, moveFile, bucketName, isR2Configured } from './r2';

const SUPABASE_BUCKET = 'patient_files';

let isBucketReady = false;
let bucketInitPromise: Promise<boolean> | null = null;

/**
 * Garante que o bucket 'patient_files' exista no Supabase Storage,
 * criando-o automaticamente via cliente ou via serverless endpoint com chave service_role se necessário.
 */
export async function ensureSupabaseBucket(): Promise<boolean> {
  if (isBucketReady) return true;
  if (bucketInitPromise) return bucketInitPromise;

  bucketInitPromise = (async () => {
    try {
      // 1. Tentar verificar se o bucket já existe
      const { data: bucket, error: getErr } = await supabase.storage.getBucket(SUPABASE_BUCKET);
      if (!getErr && bucket) {
        isBucketReady = true;
        return true;
      }

      // 2. Tentar criar diretamente via cliente Supabase (caso permitido)
      try {
        const { error: createErr } = await supabase.storage.createBucket(SUPABASE_BUCKET, {
          public: true,
          fileSizeLimit: 52428800
        });
        if (!createErr || createErr.message?.includes('already exists')) {
          isBucketReady = true;
          return true;
        }
      } catch (_) {}

      // 3. Fallback: solicitar criação via endpoint serverless (/api/storage-init)
      if (typeof window !== 'undefined') {
        try {
          const apiRes = await fetch('/api/storage-init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          if (apiRes.ok) {
            isBucketReady = true;
            return true;
          }
        } catch (_) {}
      }

      return false;
    } catch (err) {
      console.warn('[STORAGE] Erro ao assegurar existência do bucket:', err);
      return false;
    } finally {
      bucketInitPromise = null;
    }
  })();

  return bucketInitPromise;
}

// Inicializa a verificação do bucket em background na inicialização do app
if (typeof window !== 'undefined') {
  setTimeout(() => {
    ensureSupabaseBucket().catch(() => {});
  }, 1000);
}

/**
 * Obtém o ID do usuário de forma segura e resiliente,
 * com fallback para modo mobile, bypass_auth ou clinic-master.
 */
async function getStorageUserId(): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;
  } catch (_) {}

  if (typeof localStorage !== 'undefined' && localStorage.getItem('bypass_auth') === 'true') {
    return 'mock-user-id-dr-agnaldo';
  }

  return 'clinic-master';
}

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
 * Faz o upload de um arquivo para o Cloudflare R2 (prioritário para economizar cota),
 * com fallback automático e transparente para o Supabase Storage caso o R2 falhe (CORS, SSL ou endpoint).
 */
export async function uploadPatientFileToSupabase(patientIdentifier: string, file: File | Blob, filename: string, subfolder?: string) {
  const userId = await getStorageUserId();
  const targetFolder = getSafePatientPath(patientIdentifier);
  const subfolderPath = subfolder ? `${subfolder.replace(/^\/|\/$/g, '')}/` : '';
  
  const finalFilename = getSafeFilename(filename);
  const filePath = filename.includes('/') ? filename : `${userId}/${targetFolder}/${subfolderPath}${finalFilename}`;

  // 1. Prioridade Máxima: Enviar via endpoint serverless (/api/storage-upload)
  // Bypassa restrições de RLS do navegador e sincroniza a galeria automaticamente
  if (typeof window !== 'undefined') {
    try {
      const formData = new FormData();
      formData.append('file', file, finalFilename);
      formData.append('filePath', filePath);
      formData.append('patientId', targetFolder);
      if (subfolder) formData.append('subfolder', subfolder);
      formData.append('filename', finalFilename);

      const relayRes = await fetch('/api/storage-upload', {
        method: 'POST',
        body: formData
      });

      if (relayRes.ok) {
        const json = await relayRes.json();
        console.log(`[STORAGE] Upload salvo com sucesso via /api/storage-upload: ${json.path || filePath}`);
        return { path: json.path || filePath, provider: 'supabase-relay', url: json.url };
      }
    } catch (relayErr: any) {
      console.warn('[STORAGE] Falha no endpoint serverless /api/storage-upload, tentando métodos alternativos:', relayErr?.message || relayErr);
    }
  }

  // 2. Se o endpoint falhar ou em ambiente offline, tentar Cloudflare R2 direto se estiver devidamente configurado
  if (isR2Configured()) {
    try {
      await uploadFile(file, filePath);
      console.log(`[STORAGE] Upload salvo no Cloudflare R2: ${filePath}`);
      return { path: filePath, provider: 'r2' };
    } catch (error: any) {
      console.warn('[STORAGE] Cloudflare R2 indisponível ou bloqueado por CORS/TLS. Acionando fallback do Supabase Storage:', error?.message || error);
    }
  }

  // 3. Fallback: salvar diretamente via cliente do Supabase Storage
  let supaResult = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(filePath, file, {
      upsert: true
    });

  // Se o bucket não existir ("Bucket not found"), inicializa o bucket e repete o upload imediatamente!
  if (supaResult.error && (
    supaResult.error.message?.toLowerCase().includes('bucket not found') ||
    (supaResult.error as any).statusCode === '400' ||
    (supaResult.error as any).statusCode === 400 ||
    (supaResult.error as any).status === 400
  )) {
    console.warn(`[STORAGE] Bucket "${SUPABASE_BUCKET}" ausente. Inicializando bucket e repetindo upload...`);
    const initialized = await ensureSupabaseBucket();
    if (initialized) {
      supaResult = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(filePath, file, {
          upsert: true
        });
    }
  }

  if (supaResult.error) {
    console.error('[STORAGE] Erro no fallback direto do Supabase Storage:', supaResult.error);
    throw supaResult.error;
  }

  console.log(`[STORAGE] Upload salvo com sucesso no Supabase Storage: ${filePath}`);
  return { path: filePath, provider: 'supabase' };
}

/**
 * Lista todos os arquivos de um paciente (unificando Cloudflare R2 e Supabase Storage)
 */
export async function listPatientFilesFromSupabase(patientId: string, fallbackPatientName?: string, subfolder?: string) {
  const userId = await getStorageUserId();
  const idPath = getSafePatientPath(patientId);
  const fallbackPath = fallbackPatientName ? getSafePatientPath(fallbackPatientName) : '';

  // 1. Prioridade: Buscar via endpoint serverless (/api/storage-list) com privilégios administrativos
  // Resolve RLS, unifica Cloudflare R2 e Supabase Storage com URLs públicas válidas
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams({
        patientId: idPath,
        ...(fallbackPath ? { patientName: fallbackPath } : {}),
        ...(subfolder ? { subfolder } : {}),
        ...(userId ? { userId } : {})
      });

      const res = await fetch(`/api/storage-list?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.files)) {
          // Processar e enriquecer JSONs de propostas se houver
          const enriched = await Promise.all(json.files.map(async (file: any) => {
            if (file.name?.toLowerCase().endsWith('.json') && file.thumbnailLink) {
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
              } catch (_) {}
            }
            return file;
          }));
          return enriched;
        }
      }
    } catch (apiErr) {
      console.warn('[STORAGE] Erro ao consultar /api/storage-list, acionando fallback local:', apiErr);
    }
  }

  // 2. Fallback de cliente (quando offline ou mock)
  const basePath = `${userId}/${idPath}`;
  const path = subfolder ? `${basePath}/${subfolder.replace(/^\/|\/$/g, '')}/` : `${basePath}/`;

  const fetchFilesInPath = async (targetPath: string, subPrefix: string = '') => {
    const cleanPath = targetPath.replace(/^\/+|\/+$/g, '');
    const foundMap = new Map<string, any>();

    // 1. Buscar do Supabase Storage
    try {
      const { data: supaFiles } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .list(cleanPath);

      if (Array.isArray(supaFiles)) {
        for (const f of supaFiles) {
          if (f.name && !f.name.endsWith('.emptyFolderPlaceholder') && f.id !== null) {
            const storagePath = `${cleanPath}/${f.name}`;
            foundMap.set(storagePath, {
              name: f.name,
              storagePath: storagePath,
              displayName: subPrefix ? `${subPrefix}/${f.name}` : f.name,
              subfolder: subPrefix || undefined,
              created_at: f.created_at || new Date().toISOString(),
              updated_at: f.updated_at || new Date().toISOString(),
              source: 'supabase'
            });
          }
        }
      }
    } catch (e) {
      console.warn('[STORAGE] Erro ao listar do Supabase Storage:', e);
    }

    // 2. Buscar do Cloudflare R2
    try {
      const prefix = targetPath.endsWith('/') ? targetPath : `${targetPath}/`;
      const r2Files = await listFiles(prefix);

      if (Array.isArray(r2Files)) {
        for (const f of r2Files) {
          if (f.Key && !f.Key.endsWith('.emptyFolderPlaceholder')) {
            const nameParts = f.Key.split('/');
            const name = nameParts[nameParts.length - 1];
            if (!foundMap.has(f.Key)) {
              foundMap.set(f.Key, {
                name: name,
                storagePath: f.Key,
                displayName: subPrefix ? `${subPrefix}/${name}` : name,
                subfolder: subPrefix || undefined,
                created_at: f.LastModified?.toISOString() || new Date().toISOString(),
                updated_at: f.LastModified?.toISOString() || new Date().toISOString(),
                source: 'r2'
              });
            }
          }
        }
      }
    } catch (e) {
      // Ignora erro de rede/CORS do R2 para não travar a listagem do CRM
    }

    return Array.from(foundMap.values());
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
      let thumbnailLink: string | null = null;
      try {
        if (f.source === 'supabase') {
          const { data } = await supabase.storage
            .from(SUPABASE_BUCKET)
            .createSignedUrl(f.storagePath, 3600);
          thumbnailLink = data?.signedUrl || null;
        } else {
          thumbnailLink = await getFileUrl(f.storagePath, 3600);
        }
      } catch (e) {
        try {
          thumbnailLink = await getFileUrl(f.storagePath, 3600);
        } catch (_) {}
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

  return [];
}

/**
 * Deleta um arquivo específico do paciente (no Supabase e no Cloudflare R2)
 */
export async function deletePatientFileFromSupabase(patientIdentifier: string, filename: string, subfolder?: string) {
  const userId = await getStorageUserId();
  const targetFolder = getSafePatientPath(patientIdentifier);
  const subfolderPath = subfolder ? `${subfolder.replace(/^\/|\/$/g, '')}/` : '';
  const finalFilename = getSafeFilename(filename);

  let filePath: string;
  if (filename.startsWith(`${userId}/`) || filename.startsWith('clinic-master/')) {
    filePath = filename;
  } else if (filename.includes('/')) {
    filePath = `${userId}/${targetFolder}/${filename.replace(/^\/+/, '')}`;
  } else {
    filePath = `${userId}/${targetFolder}/${subfolderPath}${finalFilename}`;
  }

  // 1. Tentar endpoint serverless (/api/storage-delete) com permissão administrativa
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/storage-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, patientId: targetFolder, filename: finalFilename, subfolder })
      });
      if (res.ok) return;
    } catch (_) {}
  }

  // 2. Deletar do Supabase Storage direto
  try {
    await supabase.storage.from(SUPABASE_BUCKET).remove([filePath]);
    if (!subfolder && !filename.includes('/')) {
      const fallbackPath = `${userId}/${targetFolder}/Orcamentos/${finalFilename}`;
      await supabase.storage.from(SUPABASE_BUCKET).remove([fallbackPath]);
    }
  } catch (e) {}

  // 3. Deletar do Cloudflare R2
  try {
    await deleteFile(filePath);
  } catch (error) {
    if (!subfolder && !filename.includes('/')) {
      const fallbackPath = `${userId}/${targetFolder}/Orcamentos/${finalFilename}`;
      try {
        await deleteFile(fallbackPath);
        return;
      } catch (fallbackError) {}
    }
  }
}

/**
 * Baixa um arquivo e converte para Data URL (Supabase primeiro, R2 fallback)
 */
export async function downloadFileAsDataUrlFromSupabase(filePath: string): Promise<string> {
  // 1. Tentar Supabase Storage
  try {
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .download(filePath);

    if (!error && data) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(data);
      });
    }
  } catch (e) {}

  // 2. Tentar Cloudflare R2
  const url = await getFileUrl(filePath, 60);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Erro ao baixar arquivo do armazenamento em nuvem');
  }
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Obtém link assinado ou público para visualização (Supabase se salvo lá, R2 caso contrário)
 */
export async function getPatientFileUrlFromSupabase(patientIdentifier: string, filename: string, expiresIn: number = 3600, subfolder?: string) {
  const userId = await getStorageUserId();
  const targetFolder = getSafePatientPath(patientIdentifier);
  const subfolderPath = subfolder ? `${subfolder.replace(/^\/|\/$/g, '')}/` : '';
  const finalFilename = getSafeFilename(filename);
  
  const filePath = filename.startsWith(`${userId}/`)
    ? filename
    : (filename.includes('/')
      ? `${userId}/${targetFolder}/${filename.replace(/^\/+/, '')}`
      : `${userId}/${targetFolder}/${subfolderPath}${finalFilename}`);

  // 1. Tentar URL do Supabase Storage
  try {
    const { data: supaUrl, error: supaErr } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .createSignedUrl(filePath, expiresIn);

    if (!supaErr && supaUrl?.signedUrl) {
      return supaUrl.signedUrl;
    }

    // Fallback: tentar URL pública direta do bucket
    const { data: publicData } = supabase.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(filePath);

    if (publicData?.publicUrl) {
      return publicData.publicUrl;
    }
  } catch (e) {}

  // 2. Tentar URL do Cloudflare R2
  try {
    return await getFileUrl(filePath, expiresIn);
  } catch (error: any) {
    console.warn('Aviso ao obter URL do R2:', error.message || error);
    return null;
  }
}

/**
 * Renomeia ou move arquivo (no Supabase e no Cloudflare R2)
 */
export async function renamePatientFileInSupabase(patientIdentifier: string, oldFilename: string, newFilename: string, subfolder?: string) {
  const userId = await getStorageUserId();
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

  // Supabase Storage move
  try {
    const { error } = await supabase.storage.from(SUPABASE_BUCKET).move(oldPath, newPath);
    if (error && !oldFilename.includes('Orcamentos') && !subfolder) {
      const fallbackOld = `${userId}/${targetFolder}/Orcamentos/${getSafeFilename(oldFilename)}`;
      const fallbackNew = `${userId}/${targetFolder}/Orcamentos/${safeNewBaseName}`;
      await supabase.storage.from(SUPABASE_BUCKET).move(fallbackOld, fallbackNew);
    }
  } catch (e) {}

  // Cloudflare R2 move
  try {
    await moveFile(oldPath, newPath);
  } catch (error) {
    if (!oldFilename.includes('Orcamentos') && !subfolder) {
      const fallbackOld = `${userId}/${targetFolder}/Orcamentos/${getSafeFilename(oldFilename)}`;
      const fallbackNew = `${userId}/${targetFolder}/Orcamentos/${safeNewBaseName}`;
      try {
        await moveFile(fallbackOld, fallbackNew);
        return;
      } catch (fallbackError) {}
    }
  }
}
