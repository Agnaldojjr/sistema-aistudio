export const config = { runtime: 'edge' };
import { GoogleGenAI } from "@google/genai";

export default async (req: Request) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const url = new URL(req.url);
    const phone = url.searchParams.get("phone");

    if (!phone) {
      return new Response(JSON.stringify({ error: "Telefone é obrigatório." }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const hermesUrl = process.env.HERMES_API_URL || "http://147.15.30.138:9119";
    const username = process.env.HERMES_USERNAME || "granmagos";
    const password = process.env.HERMES_PASSWORD || "Granmagos123.";

    if (!hermesUrl || !username || !password) {
      return new Response(JSON.stringify({ name: null, message: "Configuração do Hermes ausente." }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // 1. Fazer login no Hermes
    const loginRes = await fetch(`${hermesUrl}/auth/password-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "basic",
        username,
        password,
        next: "/sessions"
      })
    });

    if (!loginRes.ok) {
      console.error("[Hermes API] Falha no login do Hermes:", loginRes.statusText);
      return new Response(JSON.stringify({ name: null }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Capturar o set-cookie da resposta do login
    const cookieHeader = loginRes.headers.get("set-cookie");
    if (!cookieHeader) {
      console.error("[Hermes API] set-cookie ausente");
      return new Response(JSON.stringify({ name: null }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // 2. Buscar lista de sessões
    const sessionsRes = await fetch(`${hermesUrl}/api/sessions`, {
      headers: {
        "Cookie": cookieHeader
      }
    });

    if (!sessionsRes.ok) {
      console.error("[Hermes API] Falha ao buscar sessões do Hermes:", sessionsRes.statusText);
      return new Response(JSON.stringify({ name: null }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const { sessions } = await sessionsRes.json();
    if (!Array.isArray(sessions)) {
      return new Response(JSON.stringify({ name: null }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Normalizar telefone para comparação (somente números)
    const targetPhone = phone.replace(/\D/g, "");

    // Buscar sessão associada a este número de telefone
    const matchedSession = sessions.find((s: any) => {
      if (s.source !== "whatsapp") return false;
      const skey = s.session_key || "";
      const phoneMatch = skey.match(/:(\d+)$/);
      if (phoneMatch) {
        const sessPhone = phoneMatch[1];
        return sessPhone.includes(targetPhone) || targetPhone.includes(sessPhone);
      }
      return false;
    });

    if (!matchedSession) {
      console.log(`[Hermes API] Nenhuma sessão encontrada para o telefone: ${targetPhone}`);
      return new Response(JSON.stringify({ name: null }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const sessionId = matchedSession.id;
    const displayName = matchedSession.display_name || "";

    // 3. Buscar mensagens da sessão identificada
    const messagesRes = await fetch(`${hermesUrl}/api/sessions/${sessionId}/messages`, {
      headers: {
        "Cookie": cookieHeader
      }
    });

    if (!messagesRes.ok) {
      return new Response(JSON.stringify({ name: displayName || null }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const { messages } = await messagesRes.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ name: displayName || null }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Estruturar histórico de conversa para alimentar o Gemini
    const chatHistory = messages
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => `${m.role === 'user' ? 'Paciente' : 'Assistente'}: ${m.content || ''}`)
      .join("\n");

    if (!chatHistory.trim()) {
      return new Response(JSON.stringify({ name: displayName || null }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // 4. Usar Gemini para extrair o nome completo caso tenha sido informado
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ name: displayName || null }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    const prompt = `Analise o histórico de conversa de WhatsApp abaixo entre um paciente e o assistente virtual da clínica.
Identifique e extraia o NOME COMPLETO do paciente (como ele se apresentou ou assinou).
Se o paciente não informou o nome completo na conversa, retorne apenas o nome de exibição (Display Name): "${displayName}".
Responda APENAS com o nome extraído. Não adicione nenhuma introdução, explicação ou formatação de markdown.

Histórico de Conversa:
${chatHistory}`;

    const geminiResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { temperature: 0.1 }
    });

    const extractedName = geminiResponse.text?.trim();
    if (extractedName && extractedName.length < 50) {
      return new Response(JSON.stringify({ name: extractedName }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response(JSON.stringify({ name: displayName || null }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (error: any) {
    console.error("Hermes-Name API Error:", error);
    return new Response(JSON.stringify({ name: null, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
};
