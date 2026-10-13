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
    const { notes } = req.body;

    if (!notes) {
      return res.status(400).json({ error: "Texto clínico de entrada é obrigatório." });
    }

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
    Você é um assistente de inteligência artificial de alto nível integrado a um prontuário clínico odontológico.
    Sua função é transformar anotações clínicas rápidas, transcrições de voz ou observações do dentista em um plano de tratamento odontológico estruturado (ODONTOGRAMA).
    
    Regras Clínicas Estritas:
    1. Identifique os dentes envolvidos utilizando o sistema de numeração FDI (Ex: 11 a 18, 21 a 28, 31 a 38, 41 a 48).
    2. Identifique as faces quando mencionadas (M: Mesial, D: Distal, O: Oclusal, V: Vestibular, L: Lingual/Palatina).
    3. Categorize o estado/condição do dente:
       - 'CARIES' (Cárie ativa / restauração necessária)
       - 'FRACTURE' (Dente quebrado/fraturado)
       - 'PULPITIS' (Dor intensa, necessidade de canal/endodontia)
       - 'MISSING' (Dente ausente)
       - 'IMPLANT' (Implante planejado/executado)
       - 'CROWN' (Coroa, faceta ou bloco planejado)
    4. Sugira procedimentos e preços médios adequados para cada dente:
       - Cárie -> "Restauração de Resina" (Preço: 250.00) aplicada na respectiva face.
       - Canal/Pulpite -> "Tratamento de Canal (Endodontia)" (Preço: 800.00).
       - Dente Ausente / Implante -> "Implante de Titânio" (Preço: 2500.00).
       - Faceta -> "Faceta de Porcelana" (Preço: 1800.00).
       - Fratura complexa -> "Coroa Provisória" (Preço: 400.00).
    `;

    const response = await generateWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            teeth: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  tooth: { type: "INTEGER" },
                  condition: { type: "STRING" }, // Ex: CARIES, PULPITIS, IMPLANT
                  notes: { type: "STRING" },
                  surfaces: {
                    type: "ARRAY",
                    items: { type: "STRING" } // Ex: ["O", "M"]
                  },
                  procedures: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        name: { type: "STRING" },
                        price: { type: "NUMBER" }
                      },
                      required: ["name", "price"]
                    }
                  }
                },
                required: ["tooth", "condition", "procedures"]
              }
            }
          },
          required: ["teeth"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Gemini API Error (suggest-plan):", error);
    res.status(500).json({ error: "Erro ao processar análise clínica de IA." });
  }
}
