import { chromium, devices } from "playwright";
const BASE = "http://localhost:8788";
const SLUG = "cloudflare-agents";
const b = await chromium.launch();
const log = (...a) => console.log(...a);

// Presenter (PC)
const pc = await b.newContext({ viewport: { width: 1280, height: 720 } });
const p = await pc.newPage();
p.on("pageerror", (e) => log("PC pageerror:", e.message));
await p.goto(`${BASE}/auth/login?returnTo=/slides/${SLUG}`);
await p.locator('button:has-text("SE"), button[value="dev-se-001"]').first().click().catch(async () => {
  // fallback: post the form directly
  await p.evaluate(async () => {
    const f = document.createElement("form"); f.method = "post"; f.action = "/auth/login";
    f.innerHTML = '<input name="userId" value="dev-se-001"><input name="returnTo" value="/slides/cloudflare-agents">';
    document.body.appendChild(f); f.submit();
  });
});
await p.waitForLoadState("networkidle");
log("after login:", p.url());
await p.goto(`${BASE}/slides/${SLUG}`);
log("detail buttons:", await p.locator("a:has-text('発表する'), a:has-text('スピーカービュー'), a:has-text('ノートを編集')").count());

await p.goto(`${BASE}/slides/${SLUG}/present`, { waitUntil: "networkidle" });
log("present url has room:", /\?r=.+&k=/.test(p.url()));
await p.waitForTimeout(2500);
const remoteUrl = await p.evaluate(() => {
  const ld = window.__remixContext.state.loaderData;
  return Object.values(ld).find((v) => v && v.remoteUrl)?.remoteUrl;
});
log("remoteUrl:", remoteUrl?.replace(/k=[^&]+/, "k=***"));
log("QR svg present:", await p.locator("svg").count() > 0);
await p.screenshot({ path: "e2e-display.png" });

// Phone (no login)
const phone = await b.newContext({ ...devices["iPhone 13"] });
const m = await phone.newPage();
m.on("pageerror", (e) => log("PHONE pageerror:", e.message));
await m.goto(remoteUrl, { waitUntil: "networkidle" });
await m.waitForTimeout(2500);
log("phone status:", await m.locator("header p").nth(1).textContent());
const deckIdx = () => p.evaluate(() => {
  const R = document.querySelector("iframe").contentWindow.Reveal;
  return R.getSlides().indexOf(R.getCurrentSlide());
});
await m.locator("button:has-text('次へ')").tap();
await m.waitForTimeout(600);
await m.locator("button:has-text('次へ')").tap();
await m.waitForTimeout(800);
log("display deck idx after 2x next:", await deckIdx());
log("phone counter:", (await m.locator("footer button").nth(1).textContent()).replace(/\s+/g, ""));
// presenter uses keyboard on display
await p.evaluate(() => document.querySelector("iframe").contentWindow.Reveal.next());
await m.waitForTimeout(800);
log("phone counter after display key:", (await m.locator("footer button").nth(1).textContent()).replace(/\s+/g, ""));
// jump
await m.locator("footer button").nth(1).tap();
await m.waitForTimeout(300);
await m.locator("ol li button").nth(9).tap();
await m.waitForTimeout(900);
log("display idx after jump to 10:", await deckIdx());
await m.screenshot({ path: "e2e-phone.png" });
log("panel collapsed on display:", await p.locator("text=スマホをリモコンにする").count() === 0);
await p.screenshot({ path: "e2e-display2.png" });

// invalid key
const bad = await phone.newPage();
const r = await bad.goto(remoteUrl.replace(/k=[^&]+/, "k=wrong"));
log("bad key status:", r.status());
await b.close();
