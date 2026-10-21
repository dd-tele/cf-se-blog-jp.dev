import { createCookieSessionStorage } from "@remix-run/cloudflare";
const AUD = "3a00eb8ffa28bcbba4d18968f91992c53e48fc582e7b645355ac68b065f42fc8";
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const forgedJwt = `${b64u({ alg: "RS256", kid: "forged" })}.${b64u({ email: "admin@cf-se-blog-jp.dev", sub: "forged-sub", aud: [AUD], iss: "https://cf-se-jp.cloudflareaccess.com", exp: 4102444800, iat: 1 })}.AAAA`;
const devStore = createCookieSessionStorage({ cookie: { name: "__cf_blog_session", secrets: ["__dev_session_secret_change_in_prod__"], path: "/", sameSite: "lax", httpOnly: true, secure: true } });
const s = await devStore.getSession(); s.set("user", { id: "dev-admin-001", email: "admin@cf-se-blog-jp.dev", displayName: "Forged", role: "admin" });
const forgedSession = (await devStore.commitSession(s)).split(";")[0];

const sess = (r) => (r.headers.getSetCookie?.() || []).some((c) => c.startsWith("__cf_blog_session=") && !c.startsWith("__cf_blog_session=;"));
async function req(port, path, { method = "GET", cookie, body, host } = {}) {
  const h = { };
  if (cookie) h.cookie = cookie;
  if (host) h.host = host;
  if (body) h["content-type"] = "application/x-www-form-urlencoded";
  const r = await fetch(`http://localhost:${port}${path}`, { method, headers: h, body, redirect: "manual" });
  const t = await r.text();
  return { st: r.status, sess: sess(r), t, loc: r.headers.get("location") || "" };
}
const rows = [];
const add = (name, port, r, extra = "") => rows.push(`${String(port).padEnd(5)} ${name.padEnd(46)} -> ${r.st}${r.sess ? " +SESSION" : ""}${r.loc ? " → " + r.loc.slice(0, 40) : ""} ${extra}`);
const ports = { 8804: "main(修正前)+Access", 8801: "修正後 Accessなし", 8802: "修正後 Access/秘密鍵なし", 8803: "修正後 Access+秘密鍵" };
for (const p of [8804, 8801, 8802, 8803]) {
  rows.push(`--- ${p} ${ports[p]}`);
  add("A. 開発ログイン POST (admin)", p, await req(p, "/auth/login", { method: "POST", body: "userId=dev-admin-001&returnTo=/" }));
  if (p === 8801) {
    const r = await req(p, "/auth/login", { method: "POST", body: "userId=dev-admin-001&returnTo=/", host: "evil.example.com" });
    add("A'. 同 POST（Host: 外部ドメイン）", p, r);
    const g = await req(p, "/auth/login", { host: "evil.example.com" });
    add("A''. GET /auth/login（Host: 外部）開発画面", p, g, g.t.includes("開発用ログイン") ? "開発画面あり" : "開発画面なし");
  }
  const j1 = await req(p, "/", { cookie: `CF_Authorization=${forgedJwt}` });
  add("B. 偽 JWT で / （自動ログイン）", p, j1);
  const j2 = await req(p, "/auth/login?returnTo=/", { cookie: `CF_Authorization=${forgedJwt}` });
  add("C. 偽 JWT で /auth/login", p, j2);
  const k = await req(p, "/api/v1/api-keys", { cookie: forgedSession });
  add("D. 開発鍵で偽造したセッションで API", p, k, k.st === 200 ? "← 認証突破" : "");
  const pub = await req(p, "/about");
  add("E. 公開ページ /about", p, pub);
}
console.log(rows.join("\n"));
