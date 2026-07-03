import { GoogleGenAI } from "@google/genai";

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
    Sua tarefa é analisar o relato de observações clínicas em texto livre abaixo e estruturar um plano de tratamento correspondente.
    
    Relato Clínico:
    "${notes}"
    
    Regras Clínicas de Mapeamento:
    1. Identifique os números dos dentes citados e os converta para o código internacional de 2 dígitos da FDI (ex: superior direito 11 a 18, superior esquerdo 21 a 28, inferior esquerdo 31 a 38, inferior direito 41 a 48).
    2. Identifique as faces ou superfícies do dente afetadas. Mapeie para um ou mais dos seguintes:
       - 'M' (Mesial), 'D' (Distal), 'O' (Oclusal - para molares/pré-molares), 'I' (Incisal - para incisivos/caninos), 'V' (Vestibular), 'L' (Lingual/Palatina), 'C' (Cervical).
    3. Identifique a condição do dente. Mapeie estritamente para um destes termos em inglês:
       - 'HEALTHY' (Saudável/Normal)
       - 'CARIES' (Cárie)
       - 'FRACTURE' (Fratura/Trinca)
       - 'MISSING' (Ausente/Extraído)
       - 'PULPITIS' (Canais inflamados, pulpite)
       - 'IMPLANT' (Implante planejado/executado)
       - 'CROWN' (Coroa, faceta ou bloco planejado)
    4. Sugira procedimentos e preços médios adequados para cada dente:
       - Cárie -> "Restauração de Resina" (Preço: 250.00) aplicada na respectiva face.
       - Canal/Pulpite -> "Tratamento de Canal (Endodontia)" (Preço: 800.00).
       - Dente Ausente / Implante -> "Implante de Titânio" (Preço: 2500.00).
       - Faceta -> "Faceta de Porcelana" (Preço: 1800.00).
       - Fratura complexa -> "Coroa Provisória" (Preço: 400.00).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
