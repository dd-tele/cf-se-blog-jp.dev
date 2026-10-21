import { chromium, devices } from "playwright";
const BASE="http://localhost:8788", slug=process.argv[2];
const b=await chromium.launch(); const pc=await b.newContext({viewport:{width:1366,height:860}}); const p=await pc.newPage();
await p.goto(`${BASE}/auth/login`);
await p.evaluate(()=>{const f=document.createElement("form");f.method="post";f.action="/auth/login";f.innerHTML='<input name="userId" value="dev-se-001"><input name="returnTo" value="/">';document.body.appendChild(f);f.submit();});
await p.waitForLoadState("networkidle");
await p.goto(`${BASE}/slides/${slug}/present`,{waitUntil:"networkidle"}); await p.waitForTimeout(2500);
const remoteUrl = await p.evaluate(()=>Object.values(window.__remixContext.state.loaderData).find(v=>v&&v.remoteUrl)?.remoteUrl);
await p.evaluate(()=>{const R=document.querySelector("iframe").contentWindow.Reveal; R.slide(11,0);});
await p.waitForTimeout(1000);
for (const name of ["iPhone 13","iPad Pro 11 landscape"]) {
  const m=await (await b.newContext({...devices[name]})).newPage();
  await m.goto(remoteUrl,{waitUntil:"networkidle"});
  for (const t of [1500,4000]) { await m.waitForTimeout(t===1500?1500:2500);
    const st=await m.evaluate(()=>[...document.querySelectorAll("iframe")].map(f=>{const R=f.contentWindow.Reveal;return R?(R.VERSION+" scroll="+(R.isScrollView?.()))+" w="+f.clientWidth+" "+JSON.stringify(R.getIndices())+(R.isReady()?"":"(notready)"):"none"}));
    console.log(name, t+"ms", "counter", (await m.locator("footer button").nth(1).textContent()).replace(/\s+/g,""), "iframes", st.join(" ")); }
}
await b.close();
