// Transactional mail for Cloudflare Field Notes (account approval, preview
// invitations). Called by the Pages app over HTTPS.
//
// Once the sending domain is onboarded to Cloudflare Email Sending this binding
// can deliver to ANY address, so the endpoint must not be open: every request
// must carry "Authorization: Bearer <EMAIL_WORKER_SECRET>" (set the same value
// as a secret on this Worker and on the Pages project).

interface Env {
  SEND_EMAIL: SendEmail;
  EMAIL_WORKER_SECRET?: string;
}

interface SendRequest {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const SENDER = "noreply@cf-se-blog-jp.dev";
const SENDER_NAME = "Cloudflare フィールドノート";
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  // Compare fixed-length digests without early exit.
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
    }
    if (!env.EMAIL_WORKER_SECRET) {
      console.error("[EmailWorker] EMAIL_WORKER_SECRET is not set; refusing to send");
      return Response.json({ success: false, error: "Email Worker is not configured" }, { status: 503 });
    }
    const auth = request.headers.get("Authorization") ?? "";
    if (!(await timingSafeEqual(auth, `Bearer ${env.EMAIL_WORKER_SECRET}`))) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
      const body = (await request.json()) as SendRequest;
      if (!body.to || !body.subject || !body.text) {
        return Response.json({ success: false, error: "Missing required fields: to, subject, text" }, { status: 400 });
      }
      if (!EMAIL_RE.test(body.to) || body.subject.length > 300) {
        return Response.json({ success: false, error: "Invalid recipient or subject" }, { status: 400 });
      }

      await env.SEND_EMAIL.send({
        from: { email: SENDER, name: SENDER_NAME },
        to: body.to,
        subject: body.subject,
        text: body.text,
        ...(body.html ? { html: body.html } : {}),
      });
      return Response.json({ success: true });
    } catch (e: any) {
      console.error("[EmailWorker] Error:", e?.code, e?.message);
      return Response.json({ success: false, error: e?.code ? `${e.code}: ${e.message}` : e?.message }, { status: 500 });
    }
  },
};
