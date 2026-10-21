import { chromium, devices } from "playwright";
import fs from "node:fs";
const FIX = new URL("./fixtures/", import.meta.url).pathname;
const BASE = "http://localhost:8788";
const log = (...a) => console.log(...a);
const b = await chromium.launch();
const pc = await b.newContext({ viewport: { width: 1366, height: 860 } });
const p = await pc.newPage();
p.on("pageerror", (e) => log("PC pageerror @", p.url(), e.message.slice(0, 40)));
// login as SE
await p.goto(`${BASE}/auth/login`);
await p.evaluate(() => {
  const f = document.createElement("form"); f.method = "post"; f.action = "/auth/login";
  f.innerHTML = '<input name="userId" value="dev-se-001"><input name="returnTo" value="/portal/slides">';
  document.body.appendChild(f); f.submit();
});
await p.waitForLoadState("networkidle");
// upload
await p.goto(`${BASE}/portal/slides/new`, { waitUntil: "networkidle" });
await p.fill("#title", "Cloudflare の開発基盤で作る PoC トラッカー");
await p.selectOption("#category", "event");
await p.fill("#eventName", "Cloudflare Developer Meetup");
await p.selectOption("#visibility", "limited");
await p.setInputFiles('input[type="file"]', FIX + "poc-deck.zip");
await p.check('input[name="presenterEnabled"]'); // presentation mode is opt-in
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.startsWith("/portal/"), { timeout: 60000, waitUntil: "commit" }).catch(async () => {
  log("upload error:", await p.locator(".bg-red-50").allTextContents());
});
await p.waitForTimeout(1500);
await p.goto(`${BASE}/portal/slides`, { waitUntil: "networkidle" });
const slug = (await p.locator(`a[href$="/present"]`).first().getAttribute("href")).split("/")[2];
log("uploaded slug:", slug);
const notesHref = await p.locator(`a[href$="/notes"]`).first().getAttribute("href");
log("notes editor:", notesHref);
// notes editor
await p.goto(`${BASE}${notesHref}`, { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
log("editor rows:", await p.locator("ol > li textarea").count());
log("row 6 title:", await p.locator("ol > li").nth(5).locator("span").nth(1).textContent());
// bulk save the speaker script through the action (same payload the UI sends)
const notes = fs.readFileSync(FIX + "poc-notes.json", "utf8");
const res = await p.evaluate(async ({ url, notes }) => {
  const fd = new FormData(); fd.set("notes", notes);
  const r = await fetch(url + "?_data=routes%2Fportal.slides.%24id.notes", { method: "POST", body: fd });
  return r.status + " " + (await r.text()).slice(0, 80);
}, { url: notesHref, notes });
log("save notes:", res);
log("-- reload editor"); await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(2000);
await p.locator("ol > li textarea").nth(11).focus();
await p.waitForTimeout(800);
await p.screenshot({ path: "e2e-editor.png" });
// present the limited deck
await p.goto(`${BASE}/slides/${slug}/present`, { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
const remoteUrl = await p.evaluate(() => Object.values(window.__remixContext.state.loaderData).find((v) => v && v.remoteUrl)?.remoteUrl);
// iPad (landscape), not logged in
const ipad = await b.newContext({ ...devices["iPad Pro 11 landscape"] });
const t = await ipad.newPage();
t.on("pageerror", (e) => log("IPAD pageerror:", e.message));
await t.goto(remoteUrl, { waitUntil: "networkidle" });
await t.waitForTimeout(3000);
await t.locator("button:has-text('次へ')").tap();
await t.waitForTimeout(400);
for (let i = 0; i < 10; i++) { await t.locator("button:has-text('次へ')").tap(); await t.waitForTimeout(250); }
await t.waitForTimeout(1500);
log("ipad counter:", (await t.locator("footer button").nth(1).textContent()).replace(/\s+/g, ""));
log("ipad note starts:", (await t.locator("main section").nth(1).innerText()).slice(0, 60).replace(/\n/g, " / "));
const previewOk = await t.evaluate(() => [...document.querySelectorAll("iframe")].map((f) => { try { return !!f.contentWindow.Reveal; } catch { return "x"; } }));
log("ipad previews have Reveal (limited deck via grant):", previewOk);
await t.screenshot({ path: "e2e-ipad.png" });
const deckIdx = await p.evaluate(() => { const R = document.querySelector("iframe").contentWindow.Reveal; return R.getSlides().indexOf(R.getCurrentSlide()); });
log("display idx:", deckIdx);
// phone
const phone = await b.newContext({ ...devices["iPhone 13"] });
const m = await phone.newPage();
await m.goto(remoteUrl, { waitUntil: "networkidle" });
await m.waitForTimeout(3000);
await m.screenshot({ path: "e2e-phone2.png" });
// anonymous direct access to limited deck must still be blocked
const anon = await (await b.newContext()).newPage();
const r = await anon.goto(`${BASE}/slides/${slug}/a/`);
log("anon limited deck status:", r.status());
await b.close();
