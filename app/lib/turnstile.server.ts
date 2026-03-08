// Cloudflare Turnstile server-side verification
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileVerifyResult {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
}

export async function verifyTurnstileToken(
  secretKey: string,
  token: string,
  ip?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!secretKey) {
    // Turnstile not configured — skip verification (fail open)
    return { ok: true };
  }

  if (!token) {
    return { ok: false, error: "Turnstile トークンが必要です" };
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (ip) formData.append("remoteip", ip);

    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const result: TurnstileVerifyResult = await res.json();

    if (result.success) {
      return { ok: true };
    }

    const codes = result["error-codes"]?.join(", ") || "unknown";
    return { ok: false, error: `Turnstile 検証失敗: ${codes}` };
  } catch (e: any) {
    // Fail open on network error to avoid blocking legitimate users
    console.error("Turnstile verification error:", e);
    return { ok: true };
  }
}
