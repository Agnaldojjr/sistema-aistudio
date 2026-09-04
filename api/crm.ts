export const config = { runtime: 'edge' };

import { createClient } from "@supabase/supabase-js";

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
    throw new Error("Supabase Admin Client não configurado no servidor (SUPABASE_SERVICE_ROLE_KEY ausente).");
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
    throw new Error("Supabase Admin Client não configurado no servidor (SUPABASE_SERVICE_ROLE_KEY ausente).");
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
  if (!userId) {
    throw new Error("DEFAULT_USER_ID não configurado no servidor.");
  }
  return userId;
}

// Helper para retornar respostas padronizadas com headers de CORS liberados
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-api-key",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS"
    }
  });
}

export default async (req: Request) => {
  // CORS Preflight para requisições de navegadores ou ferramentas como Typebot
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, x-api-key",
        "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      },
    });
  }

  // Validação da chave de API
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = process.env.CRM_API_KEY;
  if (!apiKey || apiKey !== expectedKey) {
    return jsonResponse({ error: "Acesso negado. Chave de API inválida ou ausente no cabeçalho x-api-key." }, 401);
  }

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;
    
    // Normaliza a rota para identificar a sub-rota requisitada
    const subRoute = pathname.replace(/^\/api\/crm/, "");

    // 1. GET /patients -> Busca paciente por telefone ou nome
    if (subRoute === "/patients" && req.method === "GET") {
      const search = url.searchParams.get("search") || url.searchParams.get("phone") || url.searchParams.get("name");
      if (!search) {
        return jsonResponse({ error: "Parâmetro 'search', 'phone' ou 'name' é obrigatório." }, 400);
      }

      const userId = getTargetUserId();
      const db = await getCRMDatabase(userId);

      const cleanSearchPhone = search.replace(/\D/g, "");
      const isPhoneSearch = cleanSearchPhone.length >= 8;
      const lowerSearch = search.toLowerCase();

      const patients = db.patients.filter((p: any) => {
        const pPhone = (p.phone || "").replace(/\D/g, "");
        const pMobile = (p.mobile || "").replace(/\D/g, "");
        const pName = (p.name || "").toLowerCase();
        
        const matchesPhone = isPhoneSearch && (
          (pPhone && (pPhone.includes(cleanSearchPhone) || cleanSearchPhone.includes(pPhone))) ||
          (pMobile && (pMobile.includes(cleanSearchPhone) || cleanSearchPhone.includes(pMobile)))
        );
        
        const matchesName = pName.includes(lowerSearch);
        
        return matchesPhone || matchesName;
      });

      if (patients.length === 0) {
        return jsonResponse({ error: "Paciente não encontrado." }, 404);
      }

      return jsonResponse({ patients });
    }

    // 1.5. POST /patients -> Cria um novo paciente
    if (subRoute === "/patients" && req.method === "POST") {
      const { name, phone, mobile, cpf, email } = await req.json();

      if (!name) {
        return jsonResponse({ error: "O campo name é obrigatório." }, 400);
      }

      const userId = getTargetUserId();
      const db = await getCRMDatabase(userId);

      const newPatient = {
        id: crypto.randomUUID(),
        name,
        phone: phone || "",
        mobile: mobile || "",
        cpf: cpf || "",
        email: email || "",
        createdAt: new Date().toISOString()
      };

      db.patients.push(newPatient);
      await saveCRMDatabase(userId, db);

      return jsonResponse({
        message: "Paciente cadastrado com sucesso.",
        patient: newPatient
      }, 201);
    }

    // 2. GET /appointments/slots -> Consulta horários livres
    if (subRoute === "/appointments/slots" && req.method === "GET") {
      const date = url.searchParams.get("date");
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return jsonResponse({ error: "Data inválida ou não informada. Use o formato YYYY-MM-DD." }, 400);
      }

      const userId = getTargetUserId();
      const db = await getCRMDatabase(userId);

      const standardSlots = [
        "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
        "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
        "17:00", "17:30"
      ];

      const activeAppointments = db.appointments.filter((app: any) =>
        app.date === date && app.status !== "Cancelado"
      );

      const takenTimes = activeAppointments.map((app: any) => app.time);
      const freeSlots = standardSlots.filter(time => !takenTimes.includes(time));

      return jsonResponse({ date, slots: freeSlots });
    }

    // 3. POST /appointments -> Cria agendamento
    if (subRoute === "/appointments" && req.method === "POST") {
      const { patientId, date, time, dentist, specialty, observations } = await req.json();

      if (!patientId || !date || !time) {
        return jsonResponse({ error: "Os campos patientId, date (YYYY-MM-DD) e time (HH:MM) são obrigatórios." }, 400);
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
        return jsonResponse({ error: "Formato de data (YYYY-MM-DD) ou hora (HH:MM) inválido." }, 400);
      }

      const userId = getTargetUserId();
      const db = await getCRMDatabase(userId);

      const patient = db.patients.find((p: any) => p.id === patientId);
      if (!patient) {
        return jsonResponse({ error: "Paciente não encontrado." }, 404);
      }

      const isTaken = db.appointments.some((app: any) =>
        app.date === date && app.time === time && app.status !== "Cancelado"
      );
      if (isTaken) {
        return jsonResponse({ error: "O horário selecionado já está reservado por outro paciente." }, 400);
      }

      const newAppointment = {
        id: crypto.randomUUID(),
        patientId,
        patientName: patient.name,
        date,
        time,
        dentist: dentist || "Dentista Geral",
        specialty: specialty || "Clínica Geral",
        status: "Agendado",
        observations: observations || ""
      };

      db.appointments.push(newAppointment);
      await saveCRMDatabase(userId, db);

      return jsonResponse({
        message: "Consulta agendada com sucesso.",
        appointment: newAppointment
      }, 201);
    }

    // 4. PUT /appointments/:id -> Atualização de Agendamento (Status, Data, Hora)
    const appointmentMatch = subRoute.match(/^\/appointments\/([^\/]+)$/);
    const statusMatch = subRoute.match(/^\/appointments\/([^\/]+)\/status$/);
    
    if ((appointmentMatch || statusMatch) && req.method === "PUT") {
      const id = (appointmentMatch ? appointmentMatch[1] : statusMatch![1]);
      const updates = await req.json();

      const userId = getTargetUserId();
      const db = await getCRMDatabase(userId);

      const appointmentIndex = db.appointments.findIndex((app: any) => app.id === id);
      if (appointmentIndex === -1) {
        return jsonResponse({ error: "Agendamento não encontrado." }, 404);
      }

      const app = db.appointments[appointmentIndex];

      if (updates.status) {
        const validStatuses = ["Agendado", "Confirmado", "Atendido", "Faltou", "Cancelado"];
        if (!validStatuses.includes(updates.status)) {
          return jsonResponse({ error: `Status inválido. Deve ser um de: ${validStatuses.join(", ")}` }, 400);
        }
        app.status = updates.status;
      }
      
      if (updates.date) app.date = updates.date;
      if (updates.time) app.time = updates.time;
      if (updates.dentist) app.dentist = updates.dentist;
      if (updates.observations) app.observations = updates.observations;

      db.appointments[appointmentIndex] = app;
      await saveCRMDatabase(userId, db);

      return jsonResponse({
        message: "Agendamento atualizado com sucesso.",
        appointment: app
      });
    }

    // 5. GET /patients/:id/history -> Histórico clínico
    const historyMatch = subRoute.match(/^\/patients\/([^\/]+)\/history$/);
    if (historyMatch && req.method === "GET") {
      const id = historyMatch[1];

      const userId = getTargetUserId();
      const db = await getCRMDatabase(userId);

      const patient = db.patients.find((p: any) => p.id === id);
      if (!patient) {
        return jsonResponse({ error: "Paciente não encontrado." }, 404);
      }

      const history = (db.clinical_history || []).filter((h: any) => h.patientId === id);
      const appointments = (db.appointments || []).filter((app: any) => app.patientId === id);
      const patientBudgets = patient.budgets || [];

      return jsonResponse({
        patient: { id: patient.id, name: patient.name },
        clinical_history: history,
        appointments: appointments,
        budgets: patientBudgets
      });
    }

    // 6. POST /proposals -> Cria um orçamento (proposta)
    if (subRoute === "/proposals" && req.method === "POST") {
      const { patientId, proceduresText, discountPercent, installments, totalValue } = await req.json();

      if (!patientId || !proceduresText) {
        return jsonResponse({ error: "Os campos patientId e proceduresText são obrigatórios." }, 400);
      }

      const userId = getTargetUserId();
      const db = await getCRMDatabase(userId);

      const patientIndex = db.patients.findIndex((p: any) => p.id === patientId);
      if (patientIndex === -1) {
        return jsonResponse({ error: "Paciente não encontrado." }, 404);
      }

      const patient = db.patients[patientIndex];
      const newBudget = {
        id: crypto.randomUUID(),
        versionNumber: (patient.budgets?.length || 0) + 1,
        versionLabel: `Orçamento IA ${(patient.budgets?.length || 0) + 1}`,
        createdAt: new Date().toISOString(),
        filename: `Orcamento_${patient.name.replace(/\s+/g, '_')}_IA.pdf`,
        status: "Aberto (paciente não pagou)",
        totalGross: totalValue || 0,
        totalNet: totalValue ? (totalValue * (1 - (discountPercent || 0)/100)) : 0,
        proposal: {
          patientName: patient.name,
          notes: proceduresText,
          discountPercent: discountPercent || 0,
          pixDiscountLabel: "Desconto padrão",
          installments: installments || 1,
          installmentsLabel: `Parcelado em ${installments || 1}x`,
          customDiscountAmount: 0,
          showTotalBySection: false
        },
        sections: [] // Simplified structure
      };

      if (!patient.budgets) patient.budgets = [];
      patient.budgets.push(newBudget);
      db.patients[patientIndex] = patient;
      
      await saveCRMDatabase(userId, db);

      return jsonResponse({
        message: "Orçamento criado com sucesso.",
        budget: newBudget
      }, 201);
    }

    return jsonResponse({ error: "Rota não encontrada no CRM." }, 404);

  } catch (error: any) {
    console.error("CRM API Error:", error);
    return jsonResponse({ error: error.message || "Erro interno do servidor." }, 500);
  }
};
