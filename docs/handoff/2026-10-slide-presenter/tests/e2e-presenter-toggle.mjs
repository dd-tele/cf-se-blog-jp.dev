import { chromium, devices } from "playwright";
const BASE = "http://localhost:8788", SLUG = "cloudflare-agents";
const log = (...a) => console.log(...a);
const b = await chromium.launch();
const pc = await b.newContext({ viewport: { width: 1366, height: 860 } });
const p = await pc.newPage();
p.on("pageerror", (e) => log("PC pageerror @", p.url(), e.message.slice(0, 60)));
await p.goto(`${BASE}/auth/login`);
await p.evaluate(() => { const f = document.createElement("form"); f.method = "post"; f.action = "/auth/login";
  f.innerHTML = '<input name="userId" value="dev-admin-001"><input name="returnTo" value="/">'; document.body.appendChild(f); f.submit(); });
await p.waitForLoadState("networkidle");

const status = async (url) => (await p.request.get(BASE + url)).status();
const row = () => p.locator("tr", { has: p.locator(`a[href="/slides/${SLUG}"]`) });

// 1. OFF by default
await p.goto(`${BASE}/slides/${SLUG}`, { waitUntil: "networkidle" });
log("1 OFF: present button =", await p.locator("a:has-text('発表する')").count(), "| hint =", await p.locator("text=プレゼンテーション機能（発表モード").count(), "| /present =", await status(`/slides/${SLUG}/present`), "| /speaker =", await status(`/slides/${SLUG}/speaker`));
await p.goto(`${BASE}/portal/slides`, { waitUntil: "networkidle" });
log("  list: switch =", await row().locator('[role="switch"]').getAttribute("aria-checked"), "| 発表 link =", await row().locator("a:has-text('発表')").count(), "| ノート link =", await row().locator("a:has-text('ノート')").count());

// 2. toggle ON from the list
await row().locator('[role="switch"]').click();
await p.waitForLoadState("networkidle"); await p.waitForTimeout(800);
await p.reload({ waitUntil: "networkidle" });
log("2 ON: switch =", await row().locator('[role="switch"]').getAttribute("aria-checked"), "| 発表 link =", await row().locator("a:has-text('発表')").count());
await p.goto(`${BASE}/slides/${SLUG}`, { waitUntil: "networkidle" });
log("  detail: present button =", await p.locator("a:has-text('発表する')").count(), "| hint =", await p.locator("text=プレゼンテーション機能（発表モード").count());
await p.goto(`${BASE}/slides/${SLUG}/present`, { waitUntil: "networkidle" }); await p.waitForTimeout(2000);
const remoteUrl = await p.evaluate(() => Object.values(window.__remixContext.state.loaderData).find((v) => v && v.remoteUrl)?.remoteUrl);
const phone = await (await b.newContext({ ...devices["iPhone 13"] })).newPage();
await phone.goto(remoteUrl, { waitUntil: "networkidle" }); await phone.waitForTimeout(2500);
log("  phone:", (await phone.locator("header").innerText()).split("\n").slice(0, 2).join(" / "));
await phone.locator("button:has-text('次へ')").tap(); await phone.waitForTimeout(1200);
log("  display idx after phone next:", await p.evaluate(() => { const R = document.querySelector("iframe").contentWindow.Reveal; return R.getSlides().indexOf(R.getCurrentSlide()); }));

// 3. toggle OFF → paired phone cut off on reload
await p.goto(`${BASE}/portal/slides`, { waitUntil: "networkidle" });
await row().locator('[role="switch"]').click();
await p.waitForLoadState("networkidle"); await p.waitForTimeout(800);
const r = await phone.reload({ waitUntil: "networkidle" });
log("3 OFF again: phone reload =", r.status(), "| /present =", await status(`/slides/${SLUG}/present`));

// 4. edit form checkbox round-trip
await p.goto(`${BASE}/portal/slides`, { waitUntil: "networkidle" });
const editHref = await row().locator("a:has-text('編集')").getAttribute("href");
await p.goto(BASE + editHref, { waitUntil: "networkidle" });
const cb = p.locator('input[name="presenterEnabled"]');
log("4 edit: checkbox initially =", await cb.isChecked());
await cb.check();
await Promise.all([p.waitForURL(/\/portal\/slides$/), p.click('button[type="submit"]:has-text("保存"), button[type="submit"]:has-text("更新")')]);
await p.waitForLoadState("networkidle");
log("  after save: switch =", await row().locator('[role="switch"]').getAttribute("aria-checked"));
await p.goto(BASE + editHref, { waitUntil: "networkidle" });
log("  reopen edit: checkbox =", await cb.isChecked());
await cb.uncheck();
await Promise.all([p.waitForURL(/\/portal\/slides$/), p.click('button[type="submit"]:has-text("保存"), button[type="submit"]:has-text("更新")')]);
await p.waitForLoadState("networkidle");
log("  after uncheck: switch =", await row().locator('[role="switch"]').getAttribute("aria-checked"));

// 5. new upload form has the checkbox, default unchecked
await p.goto(`${BASE}/portal/slides/new`, { waitUntil: "networkidle" });
log("5 new form: checkbox present =", await p.locator('input[name="presenterEnabled"]').count(), "| default =", await p.locator('input[name="presenterEnabled"]').isChecked());
await p.goto(`${BASE}/portal/slides`, { waitUntil: "networkidle" });
await row().screenshot({ path: "toggle-row.png" });
await p.locator("table").screenshot({ path: "toggle-table.png" });
await b.close();
