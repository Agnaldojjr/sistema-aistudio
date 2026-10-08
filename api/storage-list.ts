export const config = { runtime: 'edge' };

import { createClient } from "@supabase/supabase-js";

export default async function handler(req: Request) {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Supabase Service Role Key não configurada no servidor." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }

  try {
    const url = new URL(req.url);
    const patientId = url.searchParams.get("patientId") || "";
    const patientName = url.searchParams.get("patientName") || "";
    const subfolder = url.searchParams.get("subfolder") || "";
    const userId = url.searchParams.get("userId") || "";

    const cleanPatientId = (patientId || "Anonimo").replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "_");
    const cleanPatientName = patientName ? (patientName || "Anonimo").replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "_") : "";
    const cleanSub = subfolder ? subfolder.replace(/^\/+|\/+$/g, "") : "";

    const targetBucket = 'patient_files';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const candidateFolders: string[] = [];
    const addCandidates = (folderName: string) => {
      if (!folderName) return;
      if (cleanSub) {
        candidateFolders.push(`clinic-master/${folderName}/${cleanSub}`);
        if (userId && userId !== 'clinic-master') candidateFolders.push(`${userId}/${folderName}/${cleanSub}`);
        candidateFolders.push(`${folderName}/${cleanSub}`);
      } else {
        candidateFolders.push(`clinic-master/${folderName}`);
        if (userId && userId !== 'clinic-master') candidateFolders.push(`${userId}/${folderName}`);
        candidateFolders.push(folderName);
        candidateFolders.push(`clinic-master/${folderName}/Orcamentos`);
        if (userId && userId !== 'clinic-master') candidateFolders.push(`${userId}/${folderName}/Orcamentos`);
        candidateFolders.push(`${folderName}/Orcamentos`);
      }
    };

    addCandidates(cleanPatientId);
    if (cleanPatientName && cleanPatientName !== cleanPatientId) {
      addCandidates(cleanPatientName);
    }

    const uniqueFolders = Array.from(new Set(candidateFolders));
    const foundFilesMap = new Map<string, any>();

    // 1. Listar do Supabase Storage via admin
    for (const folder of uniqueFolders) {
      try {
        const { data: items } = await supabaseAdmin.storage
          .from(targetBucket)
          .list(folder);

        if (Array.isArray(items)) {
          for (const item of items) {
            if (item.name && !item.name.endsWith(".emptyFolderPlaceholder") && item.id !== null) {
              const fullStoragePath = `${folder}/${item.name}`;
              if (!foundFilesMap.has(item.name)) {
                const publicUrl = `${supabaseUrl}/storage/v1/object/public/${targetBucket}/${fullStoragePath}`;
                const isOrcamento = folder.endsWith("Orcamentos");
                const displayName = isOrcamento ? `Orcamentos/${item.name}` : item.name;

                foundFilesMap.set(item.name, {
                  id: fullStoragePath,
                  name: displayName,
                  storagePath: fullStoragePath,
                  thumbnailLink: publicUrl,
                  createdTime: item.created_at || new Date().toISOString(),
                  modifiedTime: item.updated_at || new Date().toISOString(),
                  mimeType: item.name.endsWith(".pdf")
                    ? "application/pdf"
                    : item.name.endsWith(".json")
                    ? "application/json"
                    : item.name.match(/\.(jpe?g|png|webp|gif|bmp)$/i)
                    ? "image/jpeg"
                    : "application/octet-stream",
                  subfolder: isOrcamento ? "Orcamentos" : (cleanSub || undefined),
                  source: "supabase",
                });
              }
            }
          }
        }
      } catch (err) {
        // Ignora pastas que não existirem
      }
    }

    // 2. Buscar fotos já indexadas do Cloudflare R2 no Supabase CRM (crm_data.galeria)
    try {
      let clinicRecords: any[] | null = null;
      try {
        const { data, error } = await supabaseAdmin
          .from('clinic_data')
          .select('crm_data')
          .limit(5);
        if (!error && Array.isArray(data)) clinicRecords = data;
      } catch (_) {}

      // Fallback com anon key se admin falhar
      if (!clinicRecords && process.env.VITE_SUPABASE_ANON_KEY) {
        try {
          const supaAnon = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data, error } = await supaAnon
            .from('clinic_data')
            .select('crm_data')
            .limit(5);
          if (!error && Array.isArray(data)) clinicRecords = data;
        } catch (_) {}
      }

      if (Array.isArray(clinicRecords)) {
        for (const row of clinicRecords) {
          const galeria = row.crm_data?.galeria;
          if (Array.isArray(galeria)) {
            for (const g of galeria) {
              const matchPatient = (
                (g.patientId && (g.patientId === patientId || g.patientId === cleanPatientId)) ||
                (patientName && g.url && g.url.toLowerCase().includes(cleanPatientName.toLowerCase())) ||
                (g.url && g.url.includes(cleanPatientId))
              );

              if (matchPatient && g.url) {
                const fileName = g.description || g.url.split('/').pop() || 'foto_cloudflare.jpg';
                if (!foundFilesMap.has(fileName)) {
                  foundFilesMap.set(fileName, {
                    id: g.url,
                    name: fileName,
                    storagePath: g.url,
                    thumbnailLink: g.url,
                    createdTime: g.date || new Date().toISOString(),
                    modifiedTime: g.date || new Date().toISOString(),
                    mimeType: "image/jpeg",
                    subfolder: cleanSub || undefined,
                    source: "r2",
                  });
                }
              }
            }
          }
        }
      }
    } catch (_) {}

    const files = Array.from(foundFilesMap.values());

    return new Response(
      JSON.stringify({
        success: true,
        patientId: cleanPatientId,
        files: files,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (err: any) {
    console.error("Exceção em /api/storage-list:", err);
    return new Response(
      JSON.stringify({ error: err.message || String(err), files: [] }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}
