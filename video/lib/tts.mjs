// Narration audio: Windows built-in speech (System.Speech), one WAV per line, plus measured durations.
// Used only when no human recording / Polly voice is supplied (see video/README in the final folder).
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { scenes, spoken } from "../narration.mjs";

/** Duration in seconds of a PCM WAV file, from its header. */
export function wavSeconds(path) {
  const b = readFileSync(path);
  let o = 12, byteRate = 0;
  while (o + 8 <= b.length) {
    const id = b.toString("ascii", o, o + 4), size = b.readUInt32LE(o + 4);
    if (id === "fmt ") byteRate = b.readUInt32LE(o + 16);
    if (id === "data") return byteRate ? size / byteRate : 0;
    o += 8 + size + (size & 1);
  }
  return 0;
}

export function synthAll(outDir, { voice = "Microsoft Zira", rate = 0 } = {}) {
  mkdirSync(outDir, { recursive: true });
  const segs = scenes.flatMap((s) => s.segs);
  const items = segs.map((g) => ({ path: `${outDir}${g.id}.wav`, text: spoken(g) }));
  const json = `${outDir}items.json`;
  writeFileSync(json, JSON.stringify(items));
  const ps1 = fileURLToPath(new URL("./tts.ps1", import.meta.url));
  const r = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1, "-Json", json, "-Voice", voice, "-Rate", String(rate)], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`speech synthesis failed: ${r.stderr || r.stdout}`);
  const durations = Object.fromEntries(segs.map((g) => [g.id, Number(wavSeconds(`${outDir}${g.id}.wav`).toFixed(3))]));
  writeFileSync(`${outDir}durations.json`, JSON.stringify(durations, null, 2));
  return durations;
}
