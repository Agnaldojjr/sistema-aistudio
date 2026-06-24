import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { patientName, doctorName, procedures } = req.body;

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
    Aja como a secretária comercial premium do dentista ${doctorName}.
    Escreva um script curto de fechamento de venda via WhatsApp para enviar o orçamento em PDF para o paciente chamado ${patientName}.
    O paciente fará os seguintes tratamentos: ${procedures.join(', ')}.
    
    A mensagem deve:
    1. Ser extremamente cordial, mas direta e com gatilho de autoridade.
    2. Explicar brevemente que o orçamento do planejamento está no PDF anexo.
    3. Perguntar qual a melhor forma de pagamento ou se podemos agendar o início.
    4. Não inventar valores em dinheiro, o valor já estará no PDF.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    res.status(200).json({ message: response.text });
  } catch (error: any) {
    console.error("Gemini API Error (budget-script):", error);
    if (error?.status === 403 || error?.status === 401) {
      return res.status(403).json({ error: "Chave da API inválida ou sem permissão." });
    }
    if (error?.status === 429) {
      return res.status(429).json({ error: "Créditos da API Google Gemini esgotados." });
    }
    res.status(500).json({ error: "Erro ao gerar script de orçamento." });
  }
}
