// Scene pacing: every narration line is a "segment". `seg()` marks when the line starts, runs the on-screen
// actions, and holds until the spoken line (plus a tail) has played, so picture and voice stay in step.
import { writeFileSync } from "node:fs";

export function director({ rec, durations, texts, scene, outDir }) {
  const marks = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const api = {
    marks,
    sleep,
    /** hold the current picture for `s` seconds */
    hold: (s) => sleep(s * 1000),
    /** Start narration line `id` now; run `actions` meanwhile; keep the picture until the line ends + tail. */
    async seg(id, actions, { tail = 0.7, lead = 0 } = {}) {
      if (lead) await sleep(lead * 1000);
      const start = rec.elapsed();
      const dur = durations[id];
      if (dur === undefined) throw new Error(`no narration duration for ${id}`);
      marks.push({ id, start, end: start + dur, text: texts[id] });
      if (actions) await actions();
      const wait = start + dur + tail * 0.45 - rec.elapsed(); // tails are trimmed globally to fit the time limit
      if (wait > 0) await sleep(wait * 1000);
    },
    save(totalSeconds) {
      writeFileSync(`${outDir}${scene}.marks.json`, JSON.stringify({ scene, seconds: Number(totalSeconds.toFixed(3)), marks }, null, 2));
    },
  };
  return api;
}
