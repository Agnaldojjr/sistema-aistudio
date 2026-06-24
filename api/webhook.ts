export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const verify_token = process.env.WHATSAPP_VERIFY_TOKEN || "senha_secreta_webhook_123";
  const url = new URL(req.url);

  // Verificação de Webhook (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === verify_token) {
      console.log("WEBHOOK_VERIFIED");
      return new Response(challenge || "", { status: 200 });
    } else {
      return new Response("Forbidden", { status: 403 });
    }
  }

  // Recebimento de mensagens (POST)
  if (req.method === "POST") {
    try {
      const body = await req.json();
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
        return new Response("EVENT_RECEIVED", { status: 200 });
      } else {
        return new Response("Not Found", { status: 404 });
      }
    } catch (e) {
      return new Response("Bad Request", { status: 400 });
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
}
