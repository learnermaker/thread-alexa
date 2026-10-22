// High-quality 1080p capture: Chromium screencast frames (JPEG q92) stamped on arrival, then encoded at a
// constant 30 fps with ffmpeg-static. (Playwright's own recordVideo caps bitrate and blurs small text.)
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

const now = () => performance.timeOrigin + performance.now(); // ms, wall clock

export async function startRecorder(page) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", ({ data, sessionId }) => {
    frames.push({ t: now(), data: Buffer.from(data, "base64") });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  const shot = async () => frames.push({ t: now(), data: await page.screenshot({ type: "jpeg", quality: 92 }) });
  await shot();
  const t0 = frames[0].t;
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  return {
    t0,
    /** seconds since the first frame, on the same clock the director uses for marks */
    elapsed: () => (now() - t0) / 1000,
    async stop(outMp4, workDir) {
      await shot();
      await cdp.send("Page.stopScreencast").catch(() => {});
      const end = frames[frames.length - 1].t;
      rmSync(workDir, { recursive: true, force: true });
      mkdirSync(workDir, { recursive: true });
      const list = [];
      frames.forEach((f, i) => {
        const name = `f${String(i).padStart(6, "0")}.jpg`;
        writeFileSync(`${workDir}${name}`, f.data);
        const next = i + 1 < frames.length ? frames[i + 1].t : end;
        list.push(`file '${name}'`, `duration ${Math.max(0.001, (next - f.t) / 1000).toFixed(4)}`);
      });
      list.push(`file 'f${String(frames.length - 1).padStart(6, "0")}.jpg'`);
      writeFileSync(`${workDir}list.txt`, list.join("\n") + "\n");
      const r = spawnSync(ffmpegPath, ["-y", "-f", "concat", "-safe", "0", "-i", `${workDir}list.txt`,
        "-vf", "fps=30,scale=1920:1080,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-an", outMp4], { encoding: "utf8" });
      if (r.status !== 0) throw new Error(`encode failed: ${(r.stderr ?? "").split("\n").slice(-12).join("\n")}`);
      rmSync(workDir, { recursive: true, force: true });
      return { frames: frames.length, seconds: (end - t0) / 1000 };
    },
  };
}
