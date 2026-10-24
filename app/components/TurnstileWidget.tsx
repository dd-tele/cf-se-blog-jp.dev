import { useEffect, useRef } from "react";

interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<TurnstileApi> {
  const w = window as unknown as { turnstile?: TurnstileApi };
  if (w.turnstile) return Promise.resolve(w.turnstile);
  return new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>('script[src^="https://challenges.cloudflare.com/turnstile"]');
    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    const started = Date.now();
    const poll = () => {
      if (w.turnstile) return resolve(w.turnstile);
      if (Date.now() - started > 15_000) return reject(new Error("Turnstile script did not load"));
      setTimeout(poll, 100);
    };
    poll();
  });
}

/**
 * Explicitly rendered Turnstile widget. Place it inside a <form>: Turnstile
 * adds a hidden `cf-turnstile-response` input carrying the token.
 * Change `resetKey` to get a fresh token (tokens are single-use).
 */
export function TurnstileWidget({
  siteKey,
  action,
  resetKey,
  onToken,
}: {
  siteKey: string;
  action: string;
  resetKey?: unknown;
  onToken?: (token: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const apiRef = useRef<TurnstileApi | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then((api) => {
        if (cancelled || !ref.current || widgetId.current) return;
        apiRef.current = api;
        widgetId.current = api.render(ref.current, {
          sitekey: siteKey,
          action,
          "refresh-expired": "auto",
          callback: (t: string) => onTokenRef.current?.(t),
          "expired-callback": () => onTokenRef.current?.(null),
          "error-callback": () => onTokenRef.current?.(null),
        });
      })
      .catch(() => onTokenRef.current?.(null));
    return () => {
      cancelled = true;
      if (widgetId.current && apiRef.current) {
        try { apiRef.current.remove(widgetId.current); } catch { /* already gone */ }
      }
      widgetId.current = null;
    };
  }, [siteKey, action]);

  useEffect(() => {
    if (resetKey === undefined || !widgetId.current || !apiRef.current) return;
    onTokenRef.current?.(null);
    try { apiRef.current.reset(widgetId.current); } catch { /* ignore */ }
  }, [resetKey]);

  return <div ref={ref} className="min-h-[1px]" />;
}
