import { GoogleGenAI } from "@google/genai";

/**
 * Lista prioritária de modelos com suporte ativo.
 * Permite customização via GEMINI_MODEL no .env e faz fallback automático
 * se o Google descontinuar ou sobrecarregar um modelo específico.
 */
export const GEMINI_FALLBACK_MODELS = [
  process.env.GEMINI_MODEL || "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-flash-latest"
];

export async function generateContentWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
    model?: string;
  }
) {
  const modelsToTry = params.model
    ? [params.model, ...GEMINI_FALLBACK_MODELS.filter(m => m !== params.model)]
    : GEMINI_FALLBACK_MODELS;

  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        ...params,
        model: modelName
      });
      return { response, modelUsed: modelName };
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      console.warn(`[Gemini Fallback] Modelo ${modelName} retornou erro (${errMsg}). Tentando próximo modelo...`);

      // Se for erro de autenticação (chave inválida), não adianta tentar outro modelo
      if (err?.status === 401 || err?.status === 403 || errMsg.includes("API key not valid")) {
        throw err;
      }
    }
  }

  throw lastError;
}
