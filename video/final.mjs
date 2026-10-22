// npm run video:final: the submission video, end to end.
//   1. narration audio (Windows built-in speech) + measured line lengths
//   2. real proof commands captured (Inspector CLI, OAuth checks)      -> video/out/proofs.json
//   3. every scene recorded at 1080p (simulator, terminals, code, diagrams)
//   4. two cuts: with voice, and captions only (no voice), plus the .srt
// Usage: node video/final.mjs [--scenes sim,close] [--reuse-tts] [--reuse-proofs] [--out <dir>]
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";
import { scenes } from "./narration.mjs";
import { synthAll } from "./lib/tts.mjs";
import { startServer } from "./lib/server.mjs";
import { recorders } from "./scenes/index.mjs";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);
const repo = fileURLToPath(new URL("../", import.meta.url));
const outDir = fileURLToPath(new URL("./out/", import.meta.url));
const finalDir = arg("out", `${outDir}final/`).replace(/\\/g, "/").replace(/\/?$/, "/");
mkdirSync(finalDir, { recursive: true });
const only = arg("scenes", "") ? arg("scenes").split(",") : scenes.map((s) => s.id);
const LIMIT = 180; // seconds: the rules say "less than three minutes"

const assembleOnly = flag("assemble-only"); // re-mux from the existing scene recordings
// 1. narration
const ttsDir = `${outDir}tts/`;
const durations = assembleOnly || flag("reuse-tts") && existsSync(`${ttsDir}durations.json`)
  ? JSON.parse(readFileSync(`${ttsDir}durations.json`, "utf8"))
  : synthAll(ttsDir, { voice: arg("voice", "Microsoft Zira"), rate: Number(arg("rate", "1")) });
const texts = Object.fromEntries(scenes.flatMap((s) => s.segs).map((g) => [g.id, g.text]));
console.log(`narration: ${Object.values(durations).reduce((a, b) => a + b, 0).toFixed(1)} s of speech`);

// 2. proofs
if (!assembleOnly && (!flag("reuse-proofs") || !existsSync(`${outDir}proofs.json`))) {
  const r = spawnSync(process.execPath, ["video/proofs.mjs"], { cwd: repo, stdio: "inherit" });
  if (r.status !== 0) throw new Error("proofs failed");
}

// 3. scenes
const browser = assembleOnly ? undefined : await chromium.launch();
const server = !assembleOnly && only.includes("sim") ? await startServer({ port: 8787, dataDir: ".data-video-final" }) : undefined;
try {
  for (const id of assembleOnly ? [] : only) {
    const stats = await recorders[id]({ browser, base: server?.base, durations, texts, outDir, workDir: `${outDir}frames-${id}/` });
    console.log(`scene ${id}: ${stats.seconds.toFixed(1)} s, ${stats.frames} frames`);
  }
} finally {
  await browser?.close();
  await server?.stop();
}

// 4. assemble
const run = (args, label) => {
  const r = spawnSync(ffmpegPath, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg ${label} failed:\n${(r.stderr ?? "").split("\n").slice(-15).join("\n")}`);
};
let offset = 0;
const timeline = [];
for (const s of scenes) {
  const m = JSON.parse(readFileSync(`${outDir}${s.id}.marks.json`, "utf8"));
  timeline.push({ scene: s.id, title: s.title, start: offset, seconds: m.seconds, marks: m.marks.map((k) => ({ ...k, gStart: offset + k.start, gEnd: offset + k.end })) });
  offset += m.seconds;
}
const total = offset;
console.log(`total runtime ${total.toFixed(1)} s`);
if (total >= LIMIT) throw new Error(`video is ${total.toFixed(1)} s; the limit is ${LIMIT} s`);
writeFileSync(`${outDir}timeline.json`, JSON.stringify({ total, timeline }, null, 2));

// captions: the narration text itself, split at sentence/clause breaks, timed across the spoken length
const chunks = (text, max = 82) => {
  const out = [];
  for (const sentence of text.replace(/(\d)\.(\d)/g, "$1<DOT>$2").match(/[^.?!]+[.?!]?/g).map((x) => x.trim().replace(/<DOT>/g, ".")).filter(Boolean)) {
    if (sentence.length <= max) { out.push(sentence); continue; }
    let cur = "";
    for (const part of sentence.split(/(?<=[,:;])\s+/)) {
      if (cur && (cur + " " + part).length > max) { out.push(cur); cur = part; } else cur = cur ? `${cur} ${part}` : part;
    }
    if (cur) out.push(cur);
  }
  return out;
};
const stamp = (sec) => {
  const ms = Math.round(sec * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor((ms % 3600000) / 60000))}:${p(Math.floor((ms % 60000) / 1000))},${p(ms % 1000, 3)}`;
};
const srt = [];
let n = 0;
for (const t of timeline) for (const k of t.marks) {
  const parts = chunks(k.text), weight = parts.reduce((a, p) => a + p.length, 0);
  let at = k.gStart;
  for (const p of parts) {
    const len = ((k.gEnd - k.gStart) * p.length) / weight;
    srt.push(String(++n), `${stamp(at)} --> ${stamp(at + len)}`, p, "");
    at += len;
  }
}
writeFileSync(`${finalDir}thread-final.srt`, srt.join("\n"));

// burned-in captions use a native 1080p ASS file (the .srt above carries the same cues)
const assTime = (sec) => {
  const cs = Math.round(sec * 100);
  const p = (n) => String(n).padStart(2, "0");
  return `${Math.floor(cs / 360000)}:${p(Math.floor((cs % 360000) / 6000))}:${p(Math.floor((cs % 6000) / 100))}.${p(cs % 100)}`;
};
const seconds = (x) => { const m = /(\d+):(\d+):(\d+),(\d+)/.exec(x); return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000; };
const cues = srt.join("\n").split("\n\n").filter(Boolean).map((b) => b.split("\n"));
const ass = [
  "[Script Info]", "ScriptType: v4.00+", "PlayResX: 1920", "PlayResY: 1080", "WrapStyle: 2", "",
  "[V4+ Styles]", "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
  "Style: Default,Segoe UI Semibold,36,&H00FFFFFF,&H00FFFFFF,&HB0101010,&HB0101010,0,0,0,0,100,100,0,0,3,10,0,2,120,120,38,1", "",
  "[Events]", "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
  ...cues.map((c) => {
    const [a, b] = c[1].split(" --> ").map(seconds);
    return `Dialogue: 0,${assTime(a)},${assTime(b)},Default,,0,0,0,,${c.slice(2).join(" ")}`;
  }),
];
writeFileSync(`${outDir}captions.ass`, ass.join("\n") + "\n");

// video: scenes are all H.264 1080p30, so they concatenate without re-encoding
const list = scenes.map((s) => `file '${`${outDir}${s.id}.mp4`.replace(/\\/g, "/")}'`).join("\n");
writeFileSync(`${outDir}scenes.txt`, `${list}\n`);
run(["-y", "-f", "concat", "-safe", "0", "-i", `${outDir}scenes.txt`, "-c", "copy", `${outDir}_all.mp4`], "concat");

// audio: each line placed at the moment its scene recorded it
const wavs = timeline.flatMap((t) => t.marks);
const inputs = wavs.flatMap((k) => ["-i", `${ttsDir}${k.id}.wav`]);
const filters = wavs.map((k, i) => `[${i}:a]aresample=48000,adelay=${Math.round(k.gStart * 1000)}|${Math.round(k.gStart * 1000)}[a${i}]`);
const filter = `${filters.join(";")};${wavs.map((_, i) => `[a${i}]`).join("")}amix=inputs=${wavs.length}:normalize=0,alimiter=limit=0.9,apad=whole_dur=${total.toFixed(3)}[aout]`;
run(["-y", ...inputs, "-filter_complex", filter, "-map", "[aout]", "-t", total.toFixed(3), "-c:a", "aac", "-b:a", "192k", `${outDir}_voice.m4a`], "voice mix");

const assEsc = `${outDir}captions.ass`.replace(/\\/g, "/").replace(/:/g, "\\:");
const vf = `ass='${assEsc}'`;
const enc = ["-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart"];
run(["-y", "-i", `${outDir}_all.mp4`, "-i", `${outDir}_voice.m4a`, "-vf", vf, ...enc, "-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-b:a", "192k", "-shortest", `${finalDir}thread-final-voiced.mp4`], "voiced cut");
run(["-y", "-i", `${outDir}_all.mp4`, "-f", "lavfi", "-t", total.toFixed(3), "-i", "anullsrc=r=48000:cl=stereo", "-vf", vf, ...enc, "-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-b:a", "64k", "-shortest", `${finalDir}thread-final-captions-only.mp4`], "captions-only cut");
console.log(`done: ${finalDir}thread-final-voiced.mp4 and thread-final-captions-only.mp4 (${total.toFixed(1)} s)`);
