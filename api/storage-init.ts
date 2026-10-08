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
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const targetBucket = 'patient_files';

    // 1. Checa se o bucket já existe
    const { data: buckets, error: listErr } = await supabaseAdmin.storage.listBuckets();
    if (listErr) {
      console.warn("Aviso ao listar buckets:", listErr);
    }

    const bucketExists = Array.isArray(buckets) && buckets.some(b => b.name === targetBucket || b.id === targetBucket);

    if (!bucketExists) {
      // 2. Cria o bucket 'patient_files' com acesso público de leitura
      const { data: newBucket, error: createErr } = await supabaseAdmin.storage.createBucket(targetBucket, {
        public: true,
        fileSizeLimit: 52428800 // 50MB
      });

      if (createErr && !createErr.message?.includes('already exists')) {
        console.error("Erro ao criar bucket patient_files:", createErr);
        return new Response(
          JSON.stringify({ error: createErr.message, details: createErr }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: "created",
          bucket: targetBucket,
          data: newBucket
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        action: "exists",
        bucket: targetBucket
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (err: any) {
    console.error("Exceção ao inicializar storage:", err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}
