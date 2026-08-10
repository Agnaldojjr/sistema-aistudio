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

    const pollinationsResponse = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }]
      })
    });
    
    const responseText = await pollinationsResponse.text();

    res.status(200).json({ message: responseText });
  } catch (error: any) {
    console.error("Pollinations API Error (budget-script):", error);
    res.status(500).json({ error: "Erro ao gerar script de orçamento." });
  }
}
