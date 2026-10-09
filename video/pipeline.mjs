// npm run video: scripted capture (beats + gallery) -> SRT captions -> ffmpeg draft MP4.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const steps = ["record.mjs", "captions.mjs", "assemble.mjs"];
for (const s of steps) {
  const r = spawnSync(process.execPath, [here + s], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
console.log("VIDEO: draft render complete (video/out/thread-draft.mp4, docs/gallery/*.png).");
