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

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não suportado" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
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

    // 1. Garantir que o bucket exista
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const bucketExists = Array.isArray(buckets) && buckets.some(b => b.name === targetBucket || b.id === targetBucket);
    if (!bucketExists) {
      await supabaseAdmin.storage.createBucket(targetBucket, {
        public: true,
        fileSizeLimit: 52428800, // 50MB
      });
    }

    const contentType = req.headers.get("content-type") || "";
    let filePath = "";
    let filename = "foto.jpg";
    let patientId = "paciente_anonimo";
    let fileBuffer: ArrayBuffer;
    let fileType = "application/octet-stream";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      filePath = (formData.get("filePath") as string) || "";
      filename = (formData.get("filename") as string) || (file?.name || "foto.jpg");
      patientId = (formData.get("patientId") as string) || "paciente_anonimo";
      const subfolder = (formData.get("subfolder") as string) || "";

      if (!file) {
        return new Response(JSON.stringify({ error: "Arquivo ausente no FormData" }), {
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }

      if (!filePath) {
        const cleanPatient = patientId.replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_');
        const cleanSub = subfolder ? `${subfolder.replace(/^\/|\/$/g, '')}/` : '';
        const cleanName = filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-.]/g, '');
        filePath = `clinic-master/${cleanPatient}/${cleanSub}${cleanName}`;
      }

      fileBuffer = await file.arrayBuffer();
      fileType = file.type || "image/jpeg";
    } else {
      // Suporte a JSON com base64
      const body = await req.json();
      filePath = body.filePath || "";
      filename = body.filename || "foto.jpg";
      patientId = body.patientId || "paciente_anonimo";
      fileType = body.contentType || "image/jpeg";
      const base64Data = body.base64?.replace(/^data:.*?;base64,/, "");

      if (!base64Data || !filePath) {
        return new Response(JSON.stringify({ error: "filePath ou base64 ausente" }), {
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }

      const binaryStr = atob(base64Data);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      fileBuffer = bytes.buffer;
    }

    // 2. Upload via Supabase Admin (bypassa RLS)
    const { data, error } = await supabaseAdmin.storage
      .from(targetBucket)
      .upload(filePath, fileBuffer, {
        contentType: fileType,
        upsert: true,
      });

    if (error) {
      console.error("Erro no upload do storage via admin:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // 3. Gerar URL pública
    const { data: publicData } = supabaseAdmin.storage.from(targetBucket).getPublicUrl(filePath);
    const publicUrl = publicData?.publicUrl || null;

    // 4. Sincronizar na galeria do paciente no CRM se for imagem
    const isImage = fileType.startsWith("image/") || filename.match(/\.(jpe?g|png|webp|gif|bmp)$/i);
    if (isImage && patientId && patientId !== "paciente_anonimo" && publicUrl) {
      try {
        const { data: clinicRecords } = await supabaseAdmin
          .from('clinic_data')
          .select('id, user_id, crm_data')
          .limit(5);

        if (Array.isArray(clinicRecords)) {
          for (const clinicRow of clinicRecords) {
            const crm = clinicRow.crm_data;
            if (crm && Array.isArray(crm.patients)) {
              if (!Array.isArray(crm.galeria)) crm.galeria = [];
              const exists = crm.galeria.some((g: any) => g.url === publicUrl || g.id === filePath);
              if (!exists) {
                crm.galeria.push({
                  id: `gal_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                  patientId: patientId,
                  url: publicUrl,
                  description: filename,
                  date: new Date().toISOString()
                });
                await supabaseAdmin
                  .from('clinic_data')
                  .update({ crm_data: crm, updated_at: new Date().toISOString() })
                  .eq('id', clinicRow.id);
              }
            }
          }
        }
      } catch (galErr) {
        console.warn("Aviso ao vincular foto no CRM clinic_data:", galErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        path: filePath,
        url: publicUrl,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (err: any) {
    console.error("Exceção em /api/storage-upload:", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}
