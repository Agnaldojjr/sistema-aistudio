import { GoogleGenAI } from "@google/genai";

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
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  try {
    const { procedure } = await req.json();
    if (!procedure) {
      return new Response(JSON.stringify({ error: "Procedimento não informado." }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Chave GEMINI_API_KEY não configurada no Netlify." }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

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
        temperature: 0.2,
      }
    });

    return new Response(JSON.stringify({ suggestion: response.text }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
    const msg = error?.message || error?.toString?.() || "Failed to generate prescription";

    let status = 500;
    let errorMsg = "Erro ao conectar com a inteligência artificial. Tente novamente mais tarde.";

    if (
      msg.includes("prepayment credits are depleted") || 
      msg.includes("RESOURCE_EXHAUSTED") ||
      errorStr.includes("RESOURCE_EXHAUSTED") ||
      error?.status === 429
    ) {
      status = 429;
      errorMsg = "Créditos da API Google Gemini esgotados. Verifique seu projeto no AI Studio e o faturamento. O plano gratuito pode ter sido excedido.";
    }

    return new Response(JSON.stringify({ error: errorMsg }), {
      status: status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
};
