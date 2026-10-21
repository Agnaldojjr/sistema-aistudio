export const config = { runtime: 'edge' };
import { GoogleGenAI } from "@google/genai";

const FALLBACK_MODELS = [
  process.env.GEMINI_MODEL || "gemini-3-flash-preview",
  "gemini-flash-latest",
  "gemini-3.5-flash"
];

async function generateWithFallback(ai: GoogleGenAI, payload: any) {
  let lastError: any = null;
  for (const model of FALLBACK_MODELS) {
    try {
      const response = await ai.models.generateContent({
        ...payload,
        model
      });
      return response;
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini Fallback] Modelo ${model} falhou:`, err?.message || err);
      if (err?.status === 401 || err?.status === 403) throw err;
    }
  }
  throw lastError;
}

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
    if (!procedure || typeof procedure !== 'string' || !procedure.trim() || procedure.length > 1000) {
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
      return new Response(JSON.stringify({ error: "Chave da API Gemini não configurada no servidor." }), {
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

    const response = await generateWithFallback(ai, {
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

  } catch (err: any) {
    console.error("Erro na geração de receita via Gemini:", err);
    return new Response(JSON.stringify({ error: "Falha na comunicação com o assistente de IA.", details: err?.message || String(err) }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
};
