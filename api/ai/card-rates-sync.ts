export const config = { runtime: 'edge' };
import { GoogleGenAI } from "@google/genai";

export default async (req: Request) => {
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
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const acquirer = body?.acquirer === "infinitetap" ? "infinitetap" : "ton";

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY não configurada." }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const acquirerLabel =
      acquirer === "infinitetap"
        ? "InfinitePay / InfiniteTap (Brasil - recebimento em 1 dia útil)"
        : "Ton (Stone - Planos Ton Brother / PromoTon no Brasil - recebimento em 1 dia útil)";

    const prompt = `Consulte as taxas oficiais vigentes no Brasil para a maquininha ${acquirerLabel}.
Retorne APENAS um objeto JSON válido (sem blocos markdown) exatamente no formato abaixo, onde:
- "under_3" representa a faixa padrão de entrada (até R$ 3 mil/mês no Ton ou padrão 1 dia útil no InfiniteTap)
- "between_3_6" representa a faixa promocional / maior faturamento (PromoTon / acima de R$ 3 mil no Ton ou faixa reduzida no InfiniteTap)
- "credit.visa_master" e "credit.elo_amex" possuem EXATAMENTE 12 números decimais (1x até 12x) em ordem crescente, representando a porcentagem (ex: 3.15 para 3,15%).

Formato obrigatório:
{
  "source": "Resumo da fonte oficial e data",
  "tiers": {
    "under_3": {
      "debit": { "visa_master": 1.37, "elo_amex": 2.51 },
      "credit": {
        "visa_master": [3.15, 5.39, 6.12, 6.85, 7.57, 8.28, 8.99, 9.69, 10.38, 11.06, 11.74, 12.40],
        "elo_amex": [4.91, 6.47, 7.20, 7.92, 8.63, 9.33, 10.03, 10.72, 11.40, 12.08, 12.75, 13.41]
      }
    },
    "between_3_6": {
      "debit": { "visa_master": 0.75, "elo_amex": 1.88 },
      "credit": {
        "visa_master": [2.69, 3.94, 4.46, 4.98, 5.49, 5.99, 6.51, 6.99, 7.51, 7.99, 8.49, 8.99],
        "elo_amex": [3.89, 5.14, 5.66, 6.18, 6.69, 7.19, 7.71, 8.19, 8.71, 9.19, 9.69, 10.19]
      }
    }
  }
}`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.1,
        tools: [{ googleSearch: {} }],
      },
    });

    const rawText = (response.text || "").trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Resposta da IA não continha JSON estruturado.");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "Falha ao sincronizar taxas via IA",
        details: err?.message || String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
