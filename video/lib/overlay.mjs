// Page-side helpers for the recorded simulator: 1080p layout, a visible cursor with click highlight,
// a step label, and a smooth "camera" (CSS zoom, so text stays crisp) for the regions that matter.
// All of this is injected by the recorder; nothing here changes the simulator's own source.
export const SIM_CSS = `
html{overflow:hidden;background:#0b0f14}
body{width:1920px;height:1080px;overflow:hidden;transform-origin:0 0;position:relative}
.sim{min-height:0;height:1080px}
.bar{height:58px;padding:0 24px;gap:.9rem}
.bar .label{font-size:1.3rem}
.bar .badge{font-size:.9rem}
.bar button{font-size:1rem;padding:.4rem .85rem}
.clock{font-size:1rem}
.stage{padding:36px 70px 0;gap:40px;justify-content:center;flex-wrap:nowrap;align-items:flex-start}
.echo{width:1280px;height:auto}
.echo-inner{width:1280px;height:680px;transform:none;grid-template-columns:44% 1fr}
.transcript{font-size:1.55rem;line-height:1.45}
.device-title{font-size:1.05rem}
.say input,.say button{font-size:1.1rem}
.phone{width:430px}
.inbox{height:680px}
.inbox-title{font-size:1.25rem}.inbox-sub{font-size:1.08rem}
.inbox-actions button{font-size:1.1rem}
.inbox .empty{font-size:1.2rem}
.drawer{position:fixed;left:0;right:0;top:540px;bottom:78px;z-index:20;border-top:2px solid var(--accent);padding:14px 40px;overflow:hidden;background:#0b1117}
.drawer-title{font-size:1.15rem;margin-bottom:.6rem}
.drawer table{font-size:.98rem}
.drawer td,.drawer th{white-space:nowrap}
.drawer-body{grid-template-columns:48% 1fr}
.wire-detail{font-size:1.08rem;padding:.7rem 1rem}
.wire-detail pre{max-height:none}
html.dim .transcript,html.dim .phone,html.dim .say,html.dim .bar,html.dim .device-title{opacity:.07;transition:opacity .5s}
html.dim #__ticker{opacity:0}
#__ticker{position:fixed;left:70px;right:70px;bottom:146px;height:54px;z-index:99990;display:flex;align-items:center;gap:22px;padding:0 20px;border:1.5px solid #2a3a4a;border-radius:10px;background:#0f1620;font:500 20px "Cascadia Mono",Consolas,monospace;color:#9aa7b4;transition:opacity .4s;white-space:nowrap;overflow:hidden}
#__ticker b{color:#37cdbe;font:700 17px 'Segoe UI',system-ui,sans-serif;letter-spacing:.06em}
#__ticker .sep{color:#34404c}
#__ticker .v{color:#e8edf2}
#__cursor{position:fixed;left:0;top:0;width:34px;height:34px;z-index:99999;pointer-events:none;transition:transform .45s cubic-bezier(.45,.05,.25,1);filter:drop-shadow(0 2px 3px rgba(0,0,0,.6))}
.__ring{position:fixed;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;border:4px solid #37cdbe;z-index:99998;pointer-events:none;animation:__ring .6s ease-out forwards}
@keyframes __ring{to{transform:scale(3.6);opacity:0}}
#__label{position:fixed;left:70px;top:66px;z-index:99990;font:600 22px 'Segoe UI',system-ui,sans-serif;color:#04201d;background:#37cdbe;padding:4px 14px;border-radius:999px;opacity:0;transition:opacity .4s}
`;

/** Runs in the page once, after the CSS is added. */
export function installOverlay() {
  const cur = document.createElement("div");
  cur.id = "__cursor";
  cur.style.transform = "translate(1200px, 760px)";
  cur.innerHTML = '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M3 2l7 19 3-8 8-3z" fill="#fff" stroke="#0b0f14" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  document.documentElement.appendChild(cur);
  const label = document.createElement("div"); label.id = "__label"; document.documentElement.appendChild(label);
  const tick = document.createElement("div"); tick.id = "__ticker"; document.documentElement.appendChild(tick);
  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  const poll = async () => {
    try {
      const w = await (await fetch("/api/wire")).json(), e = w[w.length - 1];
      if (e) tick.innerHTML = `<b>SIMULATED ALEXA+ · REAL MCP SERVER</b><span class="sep">|</span>last call <span class="v">${esc(e.request)} · ${esc(e.rpc)}${e.tool ? " · " + esc(e.tool) : ""}</span><span class="sep">|</span><span class="v">${e.status} · ${e.ms} ms</span><span class="sep">|</span>as <span class="v">${esc(e.as)} (${esc(e.via)})</span>`;
    } catch { /* server busy */ }
  };
  poll(); setInterval(poll, 500);
  // keep the newest transcript line in view
  setInterval(() => { const t = document.querySelector(".transcript"); if (t) t.scrollTop = t.scrollHeight; }, 150);
  window.__cam = { s: 1, tx: 0, ty: 0 };
  window.__moveCursor = (x, y) => { cur.style.transform = `translate(${x - 6}px, ${y - 4}px)`; };
  window.__clickFx = (x, y) => {
    const r = document.createElement("div"); r.className = "__ring"; r.style.left = x + "px"; r.style.top = y + "px";
    document.documentElement.appendChild(r); setTimeout(() => r.remove(), 700);
  };
  window.__label = (t) => { label.style.opacity = "0"; setTimeout(() => { label.textContent = t; label.style.opacity = t ? "1" : "0"; }, 250); };
  // camera: zoom to a fraction of an element's box (layout coordinates), leaving the caption band free.
  window.__focus = (sel, o = {}) => {
    const el = document.querySelector(sel); if (!el) return;
    const c = window.__cam, r = el.getBoundingClientRect();
    const crop = o.crop ?? [0, 0, 1, 1];
    const x = (r.left - c.tx) / c.s + crop[0] * r.width / c.s, y = (r.top - c.ty) / c.s + crop[1] * r.height / c.s;
    const w = (crop[2] - crop[0]) * r.width / c.s, h = (crop[3] - crop[1]) * r.height / c.s;
    const pad = o.pad ?? 30, usableH = o.usableH ?? 960;
    const s = Math.min(o.maxZoom ?? 2.4, 1920 / (w + 2 * pad), usableH / (h + 2 * pad));
    const tx = -x * s + (1920 - w * s) / 2, ty = -y * s + (usableH - h * s) / 2;
    window.__cam = { s, tx, ty };
    document.documentElement.classList.toggle("dim", Boolean(o.dim));
    document.body.style.transition = `transform ${o.ms ?? 900}ms cubic-bezier(.45,.05,.25,1)`;
    document.body.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  };
  window.__reset = (ms = 800) => {
    window.__cam = { s: 1, tx: 0, ty: 0 };
    document.documentElement.classList.remove("dim");
    document.body.style.transition = `transform ${ms}ms cubic-bezier(.45,.05,.25,1)`;
    document.body.style.transform = "none";
  };
  // on-screen center of an element (accounts for the camera transform)
  window.__center = (sel, text) => {
    const els = [...document.querySelectorAll(sel)];
    const el = text ? els.find((e) => e.textContent.trim().startsWith(text)) : els[0];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
}

/** Node-side: glide the cursor to an element, click it with a highlight ring. */
export async function clickEl(page, sel, { text, type } = {}) {
  const pt = await page.evaluate(([s, t]) => window.__center(s, t), [sel, text ?? null]);
  if (!pt) throw new Error(`clickEl: ${sel} ${text ?? ""} not found`);
  await page.evaluate(([x, y]) => window.__moveCursor(x, y), [pt.x, pt.y]);
  await new Promise((r) => setTimeout(r, 480));
  await page.mouse.move(pt.x, pt.y);
  await page.evaluate(([x, y]) => window.__clickFx(x, y), [pt.x, pt.y]);
  await page.mouse.down(); await page.mouse.up();
  if (type) await page.keyboard.type(type, { delay: 24 });
}
