import { createMimeMessage } from "mimetext";
import { EmailMessage } from "cloudflare:email";

interface Env {
  SEND_EMAIL: SendEmail;
}

interface SendRequest {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const SENDER = "noreply@cf-se-blog-jp.dev";
const SENDER_NAME = "Cloudflare Solution Blog";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
    }

    try {
      const body = (await request.json()) as SendRequest;

      if (!body.to || !body.subject) {
        return Response.json({ success: false, error: "Missing required fields: to, subject" }, { status: 400 });
      }

      const msg = createMimeMessage();
      msg.setSender({ name: SENDER_NAME, addr: SENDER });
      msg.setRecipient(body.to);
      msg.setSubject(body.subject);

      if (body.text) {
        msg.addMessage({ contentType: "text/plain", data: body.text });
      }

      if (body.html) {
        msg.addMessage({ contentType: "text/html", data: body.html });
      }

      const emailMessage = new EmailMessage(SENDER, body.to, msg.asRaw());
      await env.SEND_EMAIL.send(emailMessage);

      return Response.json({ success: true });
    } catch (e: any) {
      console.error("[EmailWorker] Error:", e);
      return Response.json({ success: false, error: e.message }, { status: 500 });
    }
  },
};
