import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60; // 60 seconds timeout for vision/PDF extraction

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Imagem ou documento PDF é obrigatório (base64)." });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor." });
    }

    const ai = new GoogleGenAI({
      apiKey: geminiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const mimeMatch = imageBase64.match(/^data:(.*?);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const base64Data = imageBase64.replace(/^data:.*?;base64,/, "");

    const prompt = `Você é um assistente odontológico especializado em analisar orçamentos antigos e planos de tratamento odontológicos a partir de imagens ou documentos PDF.
Extraia a lista completa de todos os dentes e procedimentos deste orçamento odontológico.
Ignore os valores financeiros, datas ou status antigos, pois o sistema aplicará os valores atualizados automaticamente.
Caso o documento indique que toda a arcada ou múltiplos dentes compartilham o mesmo procedimento (ex: Limpeza), extraia isso adequadamente.
Se não houver numeração de dente especificada, coloque o dente como null.
Retorne APENAS um array JSON no formato solicitado.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              toothNumber: { type: "INTEGER", description: "Número do dente em notação FDI (ex: 18, 23, 44). Se for procedimento geral, retornar null.", nullable: true },
              procedureName: { type: "STRING", description: "Nome completo do procedimento odontológico extraído." }
            },
            required: ["procedureName"]
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "[]");
    return res.status(200).json({ items: parsed });

  } catch (error: any) {
    console.error("Gemini API Error (extract-budget-vision):", error);
    return res.status(500).json({ 
      error: "Erro ao extrair orçamento da imagem/documento.", 
      details: error?.message || String(error) 
    });
  }
}
