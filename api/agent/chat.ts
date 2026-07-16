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

    const lowercaseMsg = message.toLowerCase();
    const isTestRequest = 
      lowercaseMsg.includes("varredura") || 
      lowercaseMsg.includes("testar o site") ||
      lowercaseMsg.includes("testar as abas") ||
      lowercaseMsg.includes("testar abas") ||
      lowercaseMsg.includes("teste o site") ||
      lowercaseMsg.includes("rodar testes") ||
      lowercaseMsg.includes("executar testes") ||
      lowercaseMsg.includes("rodar playwright") ||
      lowercaseMsg.includes("executar playwright") ||
      lowercaseMsg.includes("playwright") ||
      (lowercaseMsg.includes("teste") && lowercaseMsg.includes("site")) ||
      (lowercaseMsg.includes("teste") && lowercaseMsg.includes("aba"));

    if (isTestRequest) {
      const reply = `Olá, Dr. Agnaldo! Entendi que você deseja realizar uma varredura ou teste completo das abas do site.

Como esta versão hospedada no Vercel roda em um ambiente *Serverless*, eu não consigo executar o Playwright com navegadores Chromium em tempo real devido a limitações de ambiente e tempo limite de execução.

No entanto, o **Sentinel Agent** está configurado e ativo na sua **VPS Oracle**, realizando essa auditoria completa de forma automática a cada **3 horas** e sincronizando os relatórios diretamente aqui no painel.

Caso precise rodar a varredura manualmente agora, você pode:
1. Acessar a VPS Oracle via SSH e executar o script:
   \`python scripts/vps_agent_loop.py\`
2. Rodar o servidor do projeto localmente (onde o terminal possui suporte total) e enviar este mesmo comando no chat.`;

      return new Response(JSON.stringify({ reply }), {
        status: 200,
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

    const prompt = `Você é o Agente IA DevOps e de Qualidade de Software do Consultório Odontológico do Dr. Agnaldo Ferreira.
O Dr. Agnaldo está conversando com você pela Central IA do sistema.

URL Oficial do Sistema: https://sistema-aistudio.vercel.app
URL Alternativa: https://dragnaldoferreira.netlify.app

Seu papel é responder com palavras simples, claras e fáceis de entender ("palavras de leigo", sem jargões de programação excessivos) sobre o status do sistema, o que você andou analisando, corrigindo ou melhorando.

Aqui está o histórico das suas atividades de auditoria recentes (Sentinel Reports) na VPS Oracle para seu contexto:
${reportsSummary}

Responda à mensagem abaixo de forma amigável, prestativa e muito clara (seja conciso e direto):
Mensagem do Dr. Agnaldo: "${message}"`;

    const reply = await callLLM(prompt);

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

// Helper para chamar a LLM (NVIDIA, OpenRouter ou Gemini)
async function callLLM(prompt: string, jsonMode: boolean = false): Promise<string> {
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.LLM_MODEL || "minimaxai/minimax-m3";

  if (nvidiaKey) {
    console.log(`[LLM API] Chamando NVIDIA com o modelo ${modelName}...`);
    try {
      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${nvidiaKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: prompt }],
          response_format: jsonMode ? { type: "json_object" } : undefined
        })
      });
      if (response.ok) {
        const data: any = await response.json();
        return data.choices?.[0]?.message?.content || "";
      }
      console.error(`[LLM API] Erro NVIDIA: ${response.status} ${response.statusText}`);
    } catch (err) {
      console.error("[LLM API] Erro ao chamar NVIDIA:", err);
    }
  }

  if (openrouterKey) {
    console.log(`[LLM API] Chamando OpenRouter com o modelo ${modelName}...`);
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openrouterKey}`,
          "HTTP-Referer": "https://github.com/Agnaldojjr/sistema-aistudio",
          "X-Title": "Hermes Chat Agent"
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: prompt }],
          response_format: jsonMode ? { type: "json_object" } : undefined
        })
      });
      if (response.ok) {
        const data: any = await response.json();
        return data.choices?.[0]?.message?.content || "";
      }
      console.error(`[LLM API] Erro OpenRouter: ${response.status} ${response.statusText}`);
    } catch (err) {
      console.error("[LLM API] Erro ao chamar OpenRouter:", err);
    }
  }

  if (geminiKey) {
    console.log("[LLM API] Chamando Gemini (gemini-2.5-flash)...");
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: jsonMode ? { responseMimeType: "application/json" } : undefined
        })
      });
      if (response.ok) {
        const data: any = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
      console.error(`[LLM API] Erro Gemini: ${response.status} ${response.statusText}`);
    } catch (err) {
      console.error("[LLM API] Erro ao chamar Gemini:", err);
    }
  }

  throw new Error("Nenhuma chave de API de LLM configurada (NVIDIA_API_KEY, OPENROUTER_API_KEY ou GEMINI_API_KEY).");
}
