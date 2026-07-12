export const config = { runtime: 'edge' };
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

export default async (req: Request) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Mensagem inválida" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY não configurada." }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Fetch sentinel reports from Supabase for context
    let reportsSummary = "Nenhum relatório de erros registrado no momento.";
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
      const userId = process.env.DEFAULT_USER_ID || "";

      if (supabaseUrl && supabaseKey && userId) {
        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });
        const { data } = await supabase
          .from("clinic_data")
          .select("crm_data")
          .eq("user_id", userId)
          .single();

        const reports = data?.crm_data?.sentinelReports || [];
        if (reports.length > 0) {
          const pending = reports.filter((r: any) => r.status === "pending");
          const applied = reports.filter((r: any) => r.status === "applied");
          reportsSummary = `Erros Pendentes (${pending.length}):\n` +
            pending.slice(0, 10).map((r: any) => `- [${r.timestamp}] ${r.message} no arquivo ${r.file}:${r.line}`).join("\n") +
            `\n\nCorreções Aplicadas (${applied.length}):\n` +
            applied.slice(0, 10).map((r: any) => `- [${r.timestamp}] ${r.message} (PR criado para o arquivo ${r.file})`).join("\n");
        }
      }
    } catch (_) {
      reportsSummary = "Não foi possível carregar o histórico de relatórios.";
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    const prompt = `Você é o Agente IA DevOps e de Qualidade de Software do Consultório Odontológico do Dr. Agnaldo Ferreira.
O Dr. Agnaldo está conversando com você pela Central IA do sistema.
Seu papel é responder com palavras simples, claras e fáceis de entender ("palavras de leigo", sem jargões de programação excessivos) sobre o status do sistema, o que você andou analisando, corrigindo ou melhorando.

Aqui está o histórico das suas atividades de auditoria recentes (Sentinel Reports) na VPS Oracle para seu contexto:
${reportsSummary}

Responda à mensagem abaixo de forma amigável, prestativa e muito clara (seja conciso e direto):
Mensagem do Dr. Agnaldo: "${message}"`;

    const geminiResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { temperature: 0.7 }
    });

    const reply = geminiResponse.text || "Desculpe, Dr. Agnaldo. Não consegui processar a resposta agora.";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error: any) {
    console.error("Agent Chat Error:", error);
    const isQuota = error?.status === 429 || error?.message?.includes("RESOURCE_EXHAUSTED");
    return new Response(JSON.stringify({
      reply: isQuota
        ? "Desculpe, Dr. Agnaldo. Os créditos da API de inteligência artificial estão temporariamente esgotados. Tente novamente mais tarde."
        : "Desculpe, Dr. Agnaldo. Ocorreu um erro interno ao processar sua mensagem. Tente novamente em instantes."
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
};
