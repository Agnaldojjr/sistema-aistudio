import { Handler } from "@netlify/functions";

export const handler: Handler = async (event, context) => {
  const verify_token = process.env.WHATSAPP_VERIFY_TOKEN || "senha_secreta_webhook_123";

  // Verificação de Webhook (GET)
  if (event.httpMethod === "GET") {
    const mode = event.queryStringParameters?.["hub.mode"];
    const token = event.queryStringParameters?.["hub.verify_token"];
    const challenge = event.queryStringParameters?.["hub.challenge"];

    if (mode === "subscribe" && token === verify_token) {
      console.log("WEBHOOK_VERIFIED");
      return {
        statusCode: 200,
        body: challenge || "",
      };
    } else {
      return {
        statusCode: 403,
        body: "Forbidden",
      };
    }
  }

  // Recebimento de mensagens (POST)
  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body || "{}");
      if (body.object) {
        if (
          body.entry &&
          body.entry[0].changes &&
          body.entry[0].changes[0].value.messages &&
          body.entry[0].changes[0].value.messages[0]
        ) {
          const message = body.entry[0].changes[0].value.messages[0];
          console.log("Nova mensagem no WhatsApp:", JSON.stringify(message, null, 2));
        }
        return {
          statusCode: 200,
          body: "EVENT_RECEIVED",
        };
      } else {
        return {
          statusCode: 404,
          body: "Not Found",
        };
      }
    } catch (e) {
      return {
        statusCode: 400,
        body: "Bad Request",
      };
    }
  }

  return {
    statusCode: 405,
    body: "Method Not Allowed",
  };
};
