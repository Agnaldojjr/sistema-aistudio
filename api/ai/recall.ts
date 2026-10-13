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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { patientName, lastProcedure, lastVisitDate, doctorName } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(401).json({ error: "API key is not set in environment variables." });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const prompt = `
    Aja como a secretária simpática e profissional do dentista ${doctorName}.
    Escreva uma mensagem de WhatsApp para o paciente chamado ${patientName}.
    O objetivo da mensagem é ser um lembrete caloroso para agendar uma revisão (profilaxia) 
    pois já faz um tempo desde a última consulta (${lastVisitDate}) onde ele fez: ${lastProcedure}.
    Mantenha a mensagem curta (máximo 3 frases), use emojis sutis, seja educada e não invente datas ou valores.
    `;

    const response = await generateWithFallback(ai, {
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    res.status(200).json({ message: response.text });
  } catch (error: any) {
    console.error("Gemini API Error (recall):", error);
    if (error?.status === 403 || error?.status === 401) {
      return res.status(403).json({ error: "Chave da API inválida ou sem permissão." });
    }
    if (error?.status === 429) {
      return res.status(429).json({ error: "Créditos da API Google Gemini esgotados." });
    }
    res.status(500).json({ error: "Erro ao gerar mensagem de recall." });
  }
}
