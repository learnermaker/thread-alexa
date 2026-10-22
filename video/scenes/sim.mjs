// Scene "sim": the real simulator (npm run demo) driven in a browser: Echo Show + Sam's phone, the Thread Lens,
// and the "Under the hood" wire log. Everything on screen is the live app talking to the live MCP server.
import { SIM_CSS, installOverlay, clickEl } from "../lib/overlay.mjs";
import { startRecorder } from "../lib/recorder.mjs";
import { director } from "../lib/director.mjs";

export async function recordSim({ browser, base, durations, texts, outDir, workDir }) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, timezoneId: "America/Los_Angeles", locale: "en-US" });
  const page = await ctx.newPage();
  await page.goto(`${base}/`);
  await page.waitForFunction(() => /— Maya/.test(document.querySelector(".echo .device-title")?.textContent ?? "") && /— Sam/.test(document.querySelector(".phone .device-title")?.textContent ?? ""), null, { timeout: 20000 });
  await page.addStyleTag({ content: SIM_CSS });
  await page.evaluate(installOverlay);
  await page.waitForTimeout(600);

  const rec = await startRecorder(page);
  const d = director({ rec, durations, texts, scene: "sim", outDir });
  const ask = async (text) => {
    await clickEl(page, ".say input", { type: text });
    await page.waitForTimeout(250);
    const wait = page.waitForResponse((r) => r.url().endsWith("/api/agent"));
    await clickEl(page, ".say button");
    await wait;
    await page.waitForTimeout(800); // let the Lens bridge render the result
  };
  const cam0 = async () => { await page.evaluate(() => window.__reset(600)); await page.waitForTimeout(700); }; // wait out the camera move before aiming the cursor
  const lens = (crop, o = {}) => page.evaluate(([c, op]) => window.__focus(".lens-frame", { crop: c, ...op }), [crop, o]);
  const label = (t) => page.evaluate((x) => window.__label(x), t);
  const drawer = async () => { await clickEl(page, ".bar > button:last-of-type"); await page.waitForTimeout(600); };
  const zoomWire = () => page.evaluate(() => window.__focus(".wire-detail", { maxZoom: 1.7, pad: 24 }));

  await d.hold(0.6);
  await d.seg("sim1", async () => {
    await label("Simulated Alexa+ · real MCP clients · real server");
    await page.evaluate(() => window.__moveCursor(700, 330)); await d.hold(3.2);
    await page.evaluate(() => window.__moveCursor(1500, 320));
  });
  await d.seg("sim2", async () => { await label("1 · Weekend at a glance"); await ask("What's on this weekend?"); });
  await d.seg("sim3", async () => {
    await label("2 · A change: Maya can't drive Saturday morning");
    await ask("I can't drive Saturday morning.");
    await lens([0, 0, 1, 0.62], { maxZoom: 2.0, dim: true });
  }, { tail: 1.0 });
  await d.seg("sim4", async () => {
    await label("3 · Under the hood: the real JSON-RPC call");
    await cam0();
    await drawer();
    await d.hold(2.0);
    await zoomWire();
  }, { tail: 1.6 });
  await d.seg("sim5", async () => {
    await label("4 · Context Receipt: shared vs withheld");
    await cam0();
    await drawer(); // closes the drawer
    await ask("Ask Sam to take it.");
    await lens([0, 0, 1, 0.55], { maxZoom: 2.0, dim: true });
  }, { tail: 1.0 });
  await d.seg("sim6", async () => {
    await label("5 · Sam accepts on his own device, with his own token");
    await cam0();
    await clickEl(page, ".inbox-actions button", { text: "Accept" });
    await page.waitForTimeout(1300);
    await drawer();
    await d.hold(1.4);
    await zoomWire();
  }, { tail: 1.6 });
  await d.seg("sim7", async () => {
    await label("6 · Nobody is free: pharmacy delivery (simulated)");
    await cam0();
    await drawer(); // close
    await ask("Can someone else get Rosa's refill?");
    await lens([0, 0, 1, 0.55], { maxZoom: 2.0, dim: true });
  }, { tail: 1.0 });
  await d.seg("sim8", async () => {
    await label("7 · Maya approves: nothing is really ordered");
    await cam0();
    await ask("Yes, order it.");
    await lens([0, 0, 1, 0.55], { maxZoom: 2.0, dim: true });
  }, { tail: 1.0 });
  await d.seg("sim9", async () => {
    await label("8 · Saturday 7:05: rain moves the departure");
    await cam0();
    await clickEl(page, ".bar button", { text: "Sat 07:05" });
    await page.waitForTimeout(900);
  }, { tail: 1.4 });
  await d.seg("sim10", async () => {
    await label("9 · 8:21: Sam arrives, the tournament resolves");
    await clickEl(page, ".bar button", { text: "Sat 08:21" });
    await ask("We're here.");
    await lens([0, 0, 1, 0.55], { maxZoom: 2.0, dim: true });
  }, { tail: 1.6 });
  await d.hold(0.8);
  const stats = await rec.stop(`${outDir}sim.mp4`, workDir);
  d.save(stats.seconds);
  await ctx.close();
  return stats;
}
