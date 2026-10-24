// Cloudflare Turnstile server-side verification
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileVerifyResult {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
}

export interface TurnstileVerifyOptions {
  /**
   * Reject when Turnstile is not configured or siteverify is unreachable.
   * Use for forms whose abuse has side effects (e.g. sending email). The chat
   * widget keeps the historical fail-open behaviour.
   */
  failClosed?: boolean;
  /** Expected `action` passed to turnstile.render(). */
  expectedAction?: string;
  /** Hostnames the token may have been issued on. */
  allowedHostnames?: string[];
  /** Idempotency key so a retried siteverify call is not treated as replay. */
  idempotencyKey?: string;
}

export async function verifyTurnstileToken(
  secretKey: string | undefined,
  token: string,
  ip?: string,
  options: TurnstileVerifyOptions = {}
): Promise<{ ok: boolean; error?: string }> {
  const { failClosed = false, expectedAction, allowedHostnames, idempotencyKey } = options;

  if (!secretKey) {
    if (failClosed) return { ok: false, error: "Turnstile is not configured" };
    // Turnstile not configured — skip verification (fail open)
    return { ok: true };
  }

  if (!token || token.length > 2048) {
    return { ok: false, error: "Turnstile トークンが必要です" };
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (ip) formData.append("remoteip", ip);
    if (idempotencyKey) formData.append("idempotency_key", idempotencyKey);

    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const result: TurnstileVerifyResult = await res.json();

    if (!result.success) {
      const codes = result["error-codes"]?.join(", ") || "unknown";
      return { ok: false, error: `Turnstile 検証失敗: ${codes}` };
    }
    if (expectedAction && result.action !== expectedAction) {
      return { ok: false, error: `Turnstile action mismatch: ${result.action}` };
    }
    if (allowedHostnames?.length && (!result.hostname || !allowedHostnames.includes(result.hostname))) {
      return { ok: false, error: `Turnstile hostname mismatch: ${result.hostname}` };
    }
    return { ok: true };
  } catch (e: any) {
    console.error("Turnstile verification error:", e);
    if (failClosed) return { ok: false, error: "Turnstile verification unavailable" };
    // Fail open on network error to avoid blocking legitimate users
    return { ok: true };
  }
}
