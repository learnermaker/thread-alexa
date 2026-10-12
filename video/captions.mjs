// npm run video (step 2): build SRT captions from story spoken lines at beat offsets.
// Each beat's caption spans from its start to the next beat's start (last one gets 4s).
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const outDir = fileURLToPath(new URL("out/", import.meta.url));
const { beats } = JSON.parse(readFileSync(outDir + "beats.json", "utf8"));

const stamp = (sec) => {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = String(Math.floor(ms / 3_600_000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, "0");
  const s = String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0");
  const f = String(ms % 1000).padStart(3, "0");
  return `${h}:${m}:${s},${f}`;
};

const lines = [];
let n = 0;
beats.forEach((b, i) => {
  if (!b.spoken_line?.trim()) return;
  const start = b.start;
  const end = i + 1 < beats.length ? beats[i + 1].start : start + 4;
  lines.push(String(++n), `${stamp(start)} --> ${stamp(Math.max(end, start + 1))}`, b.spoken_line.trim(), "");
});

writeFileSync(outDir + "thread.srt", lines.join("\n"));
console.log(`CAPTIONS: ${n} cue(s) -> video/out/thread.srt`);
