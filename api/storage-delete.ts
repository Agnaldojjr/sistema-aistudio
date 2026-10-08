export const config = { runtime: 'edge' };

import { createClient } from "@supabase/supabase-js";

export default async function handler(req: Request) {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
    let body: any = {};
    if (req.method === "POST" || req.method === "DELETE") {
      try {
        body = await req.json();
      } catch (_) {}
    }

    const path = body.path || body.filePath || "";
    const targetBucket = 'patient_files';

    if (!path) {
      return new Response(
        JSON.stringify({ error: "Caminho do arquivo não fornecido" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let cleanPath = path.trim();
    if (cleanPath.includes('/patient_files/')) {
      cleanPath = cleanPath.split('/patient_files/')[1];
    } else if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
      try {
        const u = new URL(cleanPath);
        const parts = u.pathname.split('/patient_files/');
        if (parts.length > 1) {
          cleanPath = parts[1];
        } else {
          cleanPath = u.pathname.replace(/^\/+/, '');
        }
      } catch (_) {}
    }
    try {
      cleanPath = decodeURIComponent(cleanPath);
    } catch (_) {}
    cleanPath = cleanPath.replace(/^\/+/, '');

    const pathsToRemove = [cleanPath];

    // Se o path não começa com clinic-master, adiciona alternativas possíveis
    if (!cleanPath.startsWith("clinic-master/")) {
      pathsToRemove.push(`clinic-master/${cleanPath}`);
    }

    const { error } = await supabaseAdmin.storage
      .from(targetBucket)
      .remove(pathsToRemove);

    if (error) {
      console.warn("Aviso ao remover arquivo:", error);
    }

    // Também limpa da galeria crm_data se estiver indexada lá
    try {
      const { data: records } = await supabaseAdmin
        .from('clinic_data')
        .select('id, crm_data');
      if (Array.isArray(records)) {
        for (const row of records) {
          const galeria = row.crm_data?.galeria;
          if (Array.isArray(galeria)) {
            const initialLen = galeria.length;
            const updatedGaleria = galeria.filter((g: any) => {
              if (!g) return false;
              const matchesUrl = pathsToRemove.some((p: string) => g.url && g.url.includes(p));
              const matchesPath = pathsToRemove.some((p: string) => g.storagePath && g.storagePath.includes(p));
              return !matchesUrl && !matchesPath;
            });
            if (updatedGaleria.length !== initialLen) {
              const updatedCrm = { ...row.crm_data, galeria: updatedGaleria };
              await supabaseAdmin
                .from('clinic_data')
                .update({ crm_data: updatedCrm })
                .eq('id', row.id);
            }
          }
        }
      }
    } catch (galeriaErr) {
      console.warn("Aviso ao limpar galeria:", galeriaErr);
    }

    return new Response(
      JSON.stringify({ success: true, removed: pathsToRemove }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (err: any) {
    console.error("Exceção em /api/storage-delete:", err);
    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}
