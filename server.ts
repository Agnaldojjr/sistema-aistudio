import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { format, addDays } from "date-fns";

dotenv.config();

// Inicialização do cliente Supabase administrativo (com service role key para operações de backend)
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
    throw new Error("Supabase Admin Client não configurado no .env (SUPABASE_SERVICE_ROLE_KEY ausente).");
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

  if (!data || !data.crm_data) {
    return {
      patients: [],
      appointments: [],
      clinical_history: [],
      communications: [],
      anamnese: [],
      avisos: [],
      documentos: [],
      galeria: [],
      pagamentos: [],
      tratamentos: [],
      odontograma: []
    };
  }

  return data.crm_data;
}

// Helper para salvar a base do CRM no Supabase
async function saveCRMDatabase(userId: string, crmData: any) {
  if (!supabaseAdmin) {
    throw new Error("Supabase Admin Client não configurado no .env (SUPABASE_SERVICE_ROLE_KEY ausente).");
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

// Helper para pegar o UUID do usuário padrão da clínica
function getTargetUserId() {
  const userId = process.env.DEFAULT_USER_ID;
  if (!userId || userId === "sua_user_id_do_supabase_aqui") {
    throw new Error("DEFAULT_USER_ID não configurado no arquivo .env");
  }
  return userId;
}

// Helper para enviar mensagens por meio da API oficial de WhatsApp Cloud da Meta
async function sendWhatsAppTemplate(to: string, patientName: string, dentistName: string, date: string, time: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || "confirmacao_consulta";

  if (!token || !phoneId || token === "seu_token_de_acesso_da_meta_aqui" || phoneId === "seu_phone_number_id_da_meta_aqui") {
    console.warn("[WhatsApp API] WhatsApp não está configurado no .env (token ou phoneId com placeholders). Pulando envio.");
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
      console.error("[WhatsApp API] Erro ao enviar mensagem WhatsApp:", data);
      return false;
    }

    console.log(`[WhatsApp API] Lembrete enviado com sucesso para ${cleanPhone}. ID:`, data.messages?.[0]?.id);
    return true;
  } catch (error) {
    console.error("[WhatsApp API] Erro na requisição para Meta API:", error);
    return false;
  }
}

// Função de execução do Cron Job de Lembretes Automáticos de Consulta
async function runAppointmentRemindersJob() {
  console.log("[Cron Job] Iniciando verificação de lembretes de consultas...");
  try {
    const userId = process.env.DEFAULT_USER_ID;
    if (!userId || userId === "sua_user_id_do_supabase_aqui") {
      console.log("[Cron Job] DEFAULT_USER_ID não configurado. Pulando execução.");
      return;
    }

    const db = await getCRMDatabase(userId);
    if (!db || !db.appointments) {
      console.log("[Cron Job] Sem agendamentos para processar.");
      return;
    }

    // Calcula amanhã no formato YYYY-MM-DD
    const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");
    const todayStr = format(new Date(), "yyyy-MM-dd");

    console.log(`[Cron Job] Buscando consultas para amanhã (${tomorrowStr})...`);

    const tomorrowAppointments = db.appointments.filter((app: any) =>
      app.date === tomorrowStr && app.status === "Agendado"
    );

    console.log(`[Cron Job] Encontradas ${tomorrowAppointments.length} consultas agendadas para amanhã.`);

    let dbChanged = false;

    for (const app of tomorrowAppointments) {
      const patient = db.patients.find((p: any) => p.id === app.patientId);
      if (!patient) {
        console.warn(`[Cron Job] Paciente não encontrado para consulta ${app.id}. Pulando.`);
        continue;
      }

      const recipientPhone = patient.mobile || patient.phone;
      if (!recipientPhone) {
        console.warn(`[Cron Job] Paciente ${patient.name} não possui telefone cadastrado. Pulando.`);
        continue;
      }

      // Evita duplicidade nas últimas 24 horas
      const alreadySentToday = db.communications.some((comm: any) =>
        comm.patientId === app.patientId &&
        comm.type === "Confirmação" &&
        comm.date.startsWith(todayStr)
      );

      if (alreadySentToday) {
        console.log(`[Cron Job] Lembrete já enviado hoje para o paciente ${patient.name}. Pulando.`);
        continue;
      }

      const messageText = `Olá, ${patient.name}! Confirmamos sua consulta com o(a) Dr(a). ${app.dentist} amanhã (${app.date}) às ${app.time}?`;

      console.log(`[Cron Job] Enviando lembrete para ${patient.name} (${recipientPhone})...`);

      const success = await sendWhatsAppTemplate(
        recipientPhone,
        patient.name,
        app.dentist,
        format(addDays(new Date(), 1), "dd/MM/yyyy"),
        app.time
      );

      if (success) {
        // Registra a comunicação no banco de dados do CRM
        const newCommunication = {
          id: crypto.randomUUID(),
          patientId: app.patientId,
          type: "Confirmação",
          date: new Date().toISOString(),
          message: messageText,
          status: "Enviado",
          token: app.id // O ID da consulta serve como token para o webhook de confirmação
        };

        db.communications.push(newCommunication);
        dbChanged = true;
      }
    }

    if (dbChanged) {
      await saveCRMDatabase(userId, db);
      console.log("[Cron Job] Novas comunicações registradas e salvas no Supabase.");
    }

    console.log("[Cron Job] Verificação concluída com sucesso.");
  } catch (error) {
    console.error("[Cron Job] Erro ao executar job de lembretes:", error);
  }
}

// Configura o agendador de lembretes em segundo plano
function setupReminderScheduler() {
  // Executa uma vez 15 segundos após o boot
  setTimeout(() => {
    runAppointmentRemindersJob();
  }, 15000);

  // Executa a cada 12 horas
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;
  setInterval(() => {
    runAppointmentRemindersJob();
  }, TWELVE_HOURS);

  console.log("[Cron Job] Agendador de lembretes configurado para rodar a cada 12h.");
}

// Middleware para verificar a chave de API nas requisições do Typebot/n8n
const checkApiKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKey = req.headers["x-api-key"];
  const expectedKey = process.env.CRM_API_KEY;

  if (!expectedKey || expectedKey === "crm_secret_token_change_me_in_production") {
    console.warn("[CRM API] Alerta: CRM_API_KEY não está configurada de forma segura no .env!");
  }

  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({ error: "Acesso negado. Chave de API inválida ou ausente no cabeçalho x-api-key." });
  }
  next();
};

async function startServer() {

  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(express.json());

  // AI initialization
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Configuração de Rate Limiting para as APIs
  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 10, // Limita a 10 requisições por IP a cada janela (1 minuto)
    message: { error: 'Limite de requisições excedido. Por favor, tente novamente em alguns instantes.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Aplica o rate limiter em todas as rotas /api/
  app.use("/api/", apiLimiter);

  // Inicializa o agendador de lembretes automáticos por WhatsApp
  setupReminderScheduler();

  // ==========================================
  // WHATSAPP WEBHOOK (META)
  // ==========================================
  app.get("/api/webhook", (req, res) => {
    // Esse é o Token que você vai colar na Etapa 2 lá no painel da Meta:
    const verify_token = process.env.WHATSAPP_VERIFY_TOKEN || "senha_secreta_webhook_123";
    
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];

    if (mode && token) {
      if (mode === "subscribe" && token === verify_token) {
        console.log("WEBHOOK_VERIFIED");
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
    } else {
      res.sendStatus(400);
    }
  });

  app.post("/api/webhook", (req, res) => {
    let body = req.body;
    if (body.object) {
      if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
        const message = body.entry[0].changes[0].value.messages[0];
        console.log("Nova mensagem no WhatsApp:", JSON.stringify(message, null, 2));
        // Aqui o sistema recebe a mensagem (podemos integrar com IA ou repassar pro n8n depois)
      }
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  });

  // ==========================================
  // ROTAS DE INTEGRAÇÃO CRM - TYPEBOT / N8N
  // ==========================================

  // 1. Busca paciente por telefone (celular ou fixo)
  app.get("/api/crm/patients", checkApiKey, async (req, res) => {
    try {
      const phone = req.query.phone as string;
      if (!phone) {
        return res.status(400).json({ error: "Parâmetro 'phone' é obrigatório." });
      }

      const userId = getTargetUserId();
      const db = await getCRMDatabase(userId);

      const cleanSearchPhone = phone.replace(/\D/g, "");
      if (cleanSearchPhone.length < 8) {
        return res.status(400).json({ error: "Número de telefone muito curto." });
      }

      // Busca paciente comparando phone e mobile de forma flexível
      const patient = db.patients.find((p: any) => {
        const pPhone = (p.phone || "").replace(/\D/g, "");
        const pMobile = (p.mobile || "").replace(/\D/g, "");
        return (
          (pPhone && (pPhone.includes(cleanSearchPhone) || cleanSearchPhone.includes(pPhone))) ||
          (pMobile && (pMobile.includes(cleanSearchPhone) || cleanSearchPhone.includes(pMobile)))
        );
      });

      if (!patient) {
        return res.status(404).json({ error: "Paciente não encontrado." });
      }

      res.json({ patient });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro interno ao buscar paciente." });
    }
  });

  // 2. Consulta horários livres em um dia
  app.get("/api/crm/appointments/slots", checkApiKey, async (req, res) => {
    try {
      const date = req.query.date as string; // YYYY-MM-DD
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "Data inválida ou não informada. Use o formato YYYY-MM-DD." });
      }

      const userId = getTargetUserId();
      const db = await getCRMDatabase(userId);

      // Horários padrão de atendimento (08:00 às 18:00 com intervalo de almoço)
      const standardSlots = [
        "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
        "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
        "17:00", "17:30"
      ];

      // Filtra agendamentos ativos na data especificada
      const activeAppointments = db.appointments.filter((app: any) =>
        app.date === date && app.status !== "Cancelado"
      );

      const takenTimes = activeAppointments.map((app: any) => app.time);
      const freeSlots = standardSlots.filter(time => !takenTimes.includes(time));

      res.json({ date, slots: freeSlots });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro interno ao consultar horários." });
    }
  });

  // 3. Cria agendamento para um paciente
  app.post("/api/crm/appointments", checkApiKey, async (req, res) => {
    try {
      const { patientId, date, time, dentist, specialty, observations } = req.body;

      if (!patientId || !date || !time) {
        return res.status(400).json({ error: "Os campos patientId, date (YYYY-MM-DD) e time (HH:MM) são obrigatórios." });
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
        return res.status(400).json({ error: "Formato de data (YYYY-MM-DD) ou hora (HH:MM) inválido." });
      }

      const userId = getTargetUserId();
      const db = await getCRMDatabase(userId);

      // Verifica se o paciente existe
      const patient = db.patients.find((p: any) => p.id === patientId);
      if (!patient) {
        return res.status(404).json({ error: "Paciente não encontrado." });
      }

      // Verifica se o horário já está ocupado
      const isTaken = db.appointments.some((app: any) =>
        app.date === date && app.time === time && app.status !== "Cancelado"
      );
      if (isTaken) {
        return res.status(400).json({ error: "O horário selecionado já está reservado por outro paciente." });
      }

      const newAppointment = {
        id: crypto.randomUUID(),
        patientId,
        patientName: patient.name,
        date,
        time,
        dentist: dentist || "Dentista Geral",
        specialty: specialty || "Clínica Geral",
        status: "Agendado" as const,
        observations: observations || ""
      };

      db.appointments.push(newAppointment);
      await saveCRMDatabase(userId, db);

      res.status(201).json({
        message: "Consulta agendada com sucesso.",
        appointment: newAppointment
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro interno ao criar consulta." });
    }
  });

  // 4. Atualiza status de uma consulta (Confirmação ou Cancelamento pelo Bot)
  app.put("/api/crm/appointments/:id/status", checkApiKey, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body; // ex: 'Confirmado', 'Cancelado'

      const validStatuses = ["Agendado", "Confirmado", "Atendido", "Faltou", "Cancelado"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status inválido. Deve ser um de: ${validStatuses.join(", ")}` });
      }

      const userId = getTargetUserId();
      const db = await getCRMDatabase(userId);

      const appointmentIndex = db.appointments.findIndex((app: any) => app.id === id);
      if (appointmentIndex === -1) {
        return res.status(404).json({ error: "Agendamento não encontrado." });
      }

      db.appointments[appointmentIndex].status = status;
      await saveCRMDatabase(userId, db);

      res.json({
        message: `Agendamento atualizado para '${status}' com sucesso.`,
        appointment: db.appointments[appointmentIndex]
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro interno ao atualizar status." });
    }
  });

  // 5. Histórico e contexto clínico do paciente
  app.get("/api/crm/patients/:id/history", checkApiKey, async (req, res) => {
    try {
      const { id } = req.params;

      const userId = getTargetUserId();
      const db = await getCRMDatabase(userId);

      const patient = db.patients.find((p: any) => p.id === id);
      if (!patient) {
        return res.status(404).json({ error: "Paciente não encontrado." });
      }

      // Filtra histórico clínico e consultas anteriores/futuras do paciente
      const history = (db.clinical_history || []).filter((h: any) => h.patientId === id);
      const appointments = (db.appointments || []).filter((app: any) => app.patientId === id);

      res.json({
        patient: { id: patient.id, name: patient.name },
        clinical_history: history,
        appointments: appointments
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro interno ao buscar histórico." });
    }
  });

  // API routes
  app.post("/api/suggest-prescription", async (req, res) => {

    try {
      const { procedure } = req.body;
      
      // Validação de Input para evitar Prompt Injection e Payload Abuse
      if (!procedure || typeof procedure !== 'string' || procedure.trim().length === 0) {
        return res.status(400).json({ error: "Procedimento não informado ou em formato inválido." });
      }

      if (procedure.length > 1000) {
        return res.status(400).json({ error: "A descrição do procedimento excede o tamanho máximo permitido (1000 caracteres)." });
      }

      const prompt = `Você é um dentista experiente. O usuário vai descrever o procedimento odontológico realizado e você deve sugerir automaticamente a prescrição e instruções (posologia) para o receituário do paciente.
Por favor, liste as medicações (ex: 1. Amoxicilina 500mg - Tomar 1 cp a cada 8h por 7 dias) e em seguida as recomendações principais relacionadas ao procedimento.
Responda sempre em português, em um formato claro, para o paciente ler diretamente.
Não inclua nenhuma introdução nem saudação ("Olá, aqui está..."), responda apenas com as prescrições médicas formatadas.
Não use markdown complexo, pode usar números ou traços.

Procedimento realizado: ${procedure}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          temperature: 0.2, // low temp for clinical stuff
        }
      });

      res.json({ suggestion: response.text });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      
      const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
      const msg = error?.message || error?.toString?.() || "Failed to generate prescription";
      
      if (
        msg.includes("prepayment credits are depleted") || 
        msg.includes("RESOURCE_EXHAUSTED") ||
        errorStr.includes("RESOURCE_EXHAUSTED") ||
        error?.status === 429
      ) {
        return res.status(429).json({ error: "Créditos da API Google Gemini esgotados. Verifique seu projeto no AI Studio e o faturamento. O plano gratuito pode ter sido excedido." });
      }
      res.status(500).json({ error: "Erro ao conectar com a inteligência artificial. Tente novamente mais tarde." });
    }
  });

  // ==========================================
  // ROTAS DE IA PARA O CRM / WHATSAPP
  // ==========================================
  app.post("/api/ai/recall", async (req, res) => {
    try {
      const { patientName, lastProcedure, lastVisitDate, doctorName } = req.body;
      
      if (!patientName || !lastProcedure || !lastVisitDate || !doctorName) {
        return res.status(400).json({ error: "Parâmetros incompletos." });
      }

      const prompt = `Você é um assistente de dentista ajudando o(a) Dr(a). ${doctorName}.
O paciente ${patientName} fez o procedimento de ${lastProcedure} na data ${lastVisitDate}.
Crie uma mensagem curta, calorosa e empática para WhatsApp, perguntando como o paciente está após o tratamento e sugerindo que agende uma consulta de retorno ou avaliação, se necessário.
A mensagem deve ser direta, amigável e pronta para ser enviada no WhatsApp. Não inclua saudações iniciais suas.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          temperature: 0.7,
        }
      });

      res.json({ message: response.text });
    } catch (error: any) {
      console.error("Gemini API Error (recall):", error);
      res.status(500).json({ error: "Erro ao gerar mensagem de recall." });
    }
  });

  app.post("/api/ai/budget-script", async (req, res) => {
    try {
      const { patientName, doctorName, procedures } = req.body;
      
      if (!patientName || !doctorName || !procedures || !Array.isArray(procedures)) {
        return res.status(400).json({ error: "Parâmetros incompletos." });
      }

      const proceduresText = procedures.join(", ");
      
      const prompt = `Você é um assistente de clínica odontológica trabalhando para o(a) Dr(a). ${doctorName}.
O paciente ${patientName} tem o seguinte plano de tratamento proposto: ${proceduresText}.
Crie uma mensagem de texto persuasiva, clara e acolhedora para WhatsApp, explicando de modo simples os benefícios de realizar esses tratamentos e convidando o paciente para aprovar o orçamento e agendar a primeira sessão.
Mantenha o tom profissional mas acessível. Não inclua saudações iniciais suas, apenas a mensagem final pronta para envio.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          temperature: 0.7,
        }
      });

      res.json({ message: response.text });
    } catch (error: any) {
      console.error("Gemini API Error (budget-script):", error);
      res.status(500).json({ error: "Erro ao gerar script de orçamento." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
