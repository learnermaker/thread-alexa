// 1280x720 thumbnail: the zoomed ripple frame from the simulator scene plus the title.
// Usage: node video/thumbnail.mjs <output png>
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";

const outDir = fileURLToPath(new URL("./out/", import.meta.url));
const dest = process.argv[2] ?? `${outDir}thumbnail.png`;
const { timeline } = JSON.parse(readFileSync(`${outDir}timeline.json`, "utf8"));
const sim = timeline.find((s) => s.scene === "sim");
const mark = sim.marks.find((m) => m.id === "sim3");
const frame = `${outDir}_thumb-frame.png`;
spawnSync(ffmpegPath, ["-y", "-ss", (mark.gEnd - 0.2).toFixed(2), "-i", `${outDir}_all.mp4`, "-frames:v", "1", frame]);

const html = `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;width:1280px;height:720px;background:#0b0f14;color:#e8edf2;font-family:"Segoe UI",system-ui,sans-serif;overflow:hidden}
.l{position:absolute;left:56px;top:70px;width:520px}
.b{font-weight:800;letter-spacing:.14em;font-size:26px;color:#37cdbe}
h1{font-size:80px;line-height:1.02;margin:26px 0 24px;letter-spacing:-.02em}h1 span{color:#37cdbe}
p{font-size:30px;color:#9aa7b4;margin:0 0 10px;line-height:1.3}
.r{position:absolute;right:36px;top:60px;width:640px;height:600px;background:#0d1626;border-radius:22px;border:3px solid #37cdbe;overflow:hidden;box-shadow:0 20px 60px #000}
.r img{position:absolute;width:900px;left:-122px;top:-56px;}
.tag{position:absolute;left:56px;bottom:52px;font-size:26px;font-weight:700;color:#04201d;background:#37cdbe;padding:8px 20px;border-radius:999px}
</style>
<div class="l"><div class="b">THREAD</div><h1>Don't lose <span>the thread.</span></h1><p>One change. Three commitments.</p><p>Alexa+ MCP server · MCP App · Agent Skill</p></div>
<div class="r"><img src="data:image/png;base64,${readFileSync(frame).toString("base64")}"></div>
<div class="tag">Simulated Alexa+ · real MCP server</div>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.setContent(html);
await page.waitForTimeout(500);
await page.screenshot({ path: dest });
await browser.close();
console.log(`thumbnail: ${dest}`);
