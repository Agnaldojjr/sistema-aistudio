import { schedule } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { format, addDays } from "date-fns";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : null;

// Helper para buscar a base do CRM no Supabase
async function getCRMDatabase(userId: string) {
  if (!supabaseAdmin) {
    throw new Error("Supabase Admin Client não configurado no Netlify.");
  }
  const { data, error } = await supabaseAdmin
    .from("clinic_data")
    .select("crm_data")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Erro ao buscar dados do CRM no Supabase:", error);
    throw error;
  }

  return data?.crm_data || null;
}

// Helper para salvar a base do CRM no Supabase
async function saveCRMDatabase(userId: string, crmData: any) {
  if (!supabaseAdmin) {
    throw new Error("Supabase Admin Client não configurado no Netlify.");
  }
  const { error } = await supabaseAdmin
    .from("clinic_data")
    .upsert({
      user_id: userId,
      crm_data: crmData,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });

  if (error) {
    console.error("Erro ao salvar dados do CRM no Supabase:", error);
    throw error;
  }
}

// Helper para enviar mensagens por meio da API oficial de WhatsApp Cloud da Meta
async function sendWhatsAppTemplate(to: string, patientName: string, dentistName: string, date: string, time: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || "confirmacao_consulta";

  if (!token || !phoneId) {
    console.warn("[Scheduled reminders] WhatsApp não está configurado no Netlify. Pulando envio.");
    return false;
  }

  // Limpa o número de telefone do paciente (apenas números)
  let cleanPhone = to.replace(/\D/g, "");
  // Adiciona DDI do Brasil se necessário
  if (cleanPhone.length >= 10 && !cleanPhone.startsWith("55")) {
    cleanPhone = "55" + cleanPhone;
  }

  const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanPhone,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: "pt_BR"
      },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: patientName },
            { type: "text", text: dentistName },
            { type: "text", text: date },
            { type: "text", text: time }
          ]
        }
      ]
    }
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json() as any;
    if (!response.ok) {
      console.error("[Scheduled reminders] Erro ao enviar mensagem WhatsApp:", data);
      return false;
    }

    console.log(`[Scheduled reminders] Lembrete enviado com sucesso para ${cleanPhone}. ID:`, data.messages?.[0]?.id);
    return true;
  } catch (error) {
    console.error("[Scheduled reminders] Erro na requisição para Meta API:", error);
    return false;
  }
}

const handler = async (event: any) => {
  console.log("[Scheduled reminders] Iniciando verificação de lembretes...");
  try {
    const userId = process.env.DEFAULT_USER_ID;
    if (!userId) {
      console.log("[Scheduled reminders] DEFAULT_USER_ID não configurado no Netlify. Pulando.");
      return { statusCode: 200, body: "DEFAULT_USER_ID missing" };
    }

    const db = await getCRMDatabase(userId);
    if (!db || !db.appointments) {
      console.log("[Scheduled reminders] Sem agendamentos para processar.");
      return { statusCode: 200, body: "No appointments found" };
    }

    // Calcula amanhã no formato YYYY-MM-DD
    const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");
    const todayStr = format(new Date(), "yyyy-MM-dd");

    console.log(`[Scheduled reminders] Buscando consultas para amanhã (${tomorrowStr})...`);

    const tomorrowAppointments = db.appointments.filter((app: any) =>
      app.date === tomorrowStr && app.status === "Agendado"
    );

    console.log(`[Scheduled reminders] Encontradas ${tomorrowAppointments.length} consultas agendadas.`);

    let dbChanged = false;
    const crypto = require("crypto");

    for (const app of tomorrowAppointments) {
      const patient = db.patients.find((p: any) => p.id === app.patientId);
      if (!patient) continue;

      const recipientPhone = patient.mobile || patient.phone;
      if (!recipientPhone) continue;

      // Evita duplicidade nas últimas 24 horas
      const alreadySentToday = db.communications.some((comm: any) =>
        comm.patientId === app.patientId &&
        comm.type === "Confirmação" &&
        comm.date.startsWith(todayStr)
      );

      if (alreadySentToday) {
        console.log(`[Scheduled reminders] Lembrete já enviado hoje para o paciente ${patient.name}. Pulando.`);
        continue;
      }

      const messageText = `Olá, ${patient.name}! Confirmamos sua consulta com o(a) Dr(a). ${app.dentist} amanhã (${app.date}) às ${app.time}?`;

      console.log(`[Scheduled reminders] Enviando lembrete para ${patient.name} (${recipientPhone})...`);

      const success = await sendWhatsAppTemplate(
        recipientPhone,
        patient.name,
        app.dentist,
        format(addDays(new Date(), 1), "dd/MM/yyyy"),
        app.time
      );

      if (success) {
        db.communications.push({
          id: crypto.randomUUID(),
          patientId: app.patientId,
          type: "Confirmação",
          date: new Date().toISOString(),
          message: messageText,
          status: "Enviado",
          token: app.id
        });
        dbChanged = true;
      }
    }

    if (dbChanged) {
      await saveCRMDatabase(userId, db);
      console.log("[Scheduled reminders] Banco de dados atualizado com novos logs de envio.");
    }

    console.log("[Scheduled reminders] Rotina concluída.");
    return { statusCode: 200, body: "Reminders processed successfully" };

  } catch (error: any) {
    console.error("[Scheduled reminders] Erro crítico:", error);
    return { statusCode: 500, body: error.message || "Internal Server Error" };
  }
};

// Configura para executar diariamente às 12:00 UTC (09:00 Horário de Brasília)
export default schedule("0 12 * * *", handler);
