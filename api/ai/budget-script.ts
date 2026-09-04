import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { patientName, doctorName, procedures } = req.body;

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

    let responseText = "";

    if (process.env.GEMINI_API_KEY) {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: { temperature: 0.7 }
      });
      responseText = response.text || "";
    } else if (process.env.DEEPSEEK_API_KEY) {
      const deepseekKey = process.env.DEEPSEEK_API_KEY;
      const aiResponse = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${deepseekKey}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await aiResponse.json();
      responseText = data.choices?.[0]?.message?.content || "Erro ao gerar script com AI.";
    } else {
      throw new Error("Nenhuma chave de IA configurada (GEMINI_API_KEY ou DEEPSEEK_API_KEY).");
    }

    res.status(200).json({ message: responseText });
  } catch (error: any) {
    console.error("Gemini API Error (budget-script):", error);
    res.status(500).json({ 
      error: "Erro ao gerar script de orçamento.", 
      details: error?.message || String(error) 
    });
  }
}
