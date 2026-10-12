// npm run video (step 3): assemble the draft MP4 with ffmpeg-static.
// Builds a 1920x1080 H.264 clip by holding each beat's Lens-mode gallery still for its duration,
// muxes each beat's voice MP3 (web/public/voices/<id>.mp3) at its beat offset (silent if missing),
// and burns in the SRT captions. Output: video/out/thread-draft.mp4 (gitignored).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";

const repo = new URL("../", import.meta.url);
const outDir = fileURLToPath(new URL("out/", import.meta.url));
const galleryDir = fileURLToPath(new URL("../docs/gallery/", import.meta.url));
const voicesDir = fileURLToPath(new URL("web/public/voices/", repo));
mkdirSync(outDir, { recursive: true });

const { duration, beats } = JSON.parse(readFileSync(outDir + "beats.json", "utf8"));
const srt = outDir + "thread.srt";
const out = outDir + "thread-draft.mp4";

if (!ffmpegPath || !existsSync(ffmpegPath)) throw new Error("ffmpeg-static binary not found; run npm install");

// A black fallback still, so a missing gallery frame never breaks assembly.
const blackPng = outDir + "_black.png";
const run = (args, label) => {
  const r = spawnSync(ffmpegPath, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg ${label} failed:\n${(r.stderr ?? "").split("\n").slice(-20).join("\n")}`);
};
run(["-y", "-f", "lavfi", "-i", "color=c=black:s=1920x1080:d=1", "-frames:v", "1", blackPng], "black still");

// Per-beat segments: hold the beat's mode still for (next.start - start), last beat to total duration.
const seg = (i) => {
  const b = beats[i];
  const end = i + 1 < beats.length ? beats[i + 1].start : duration;
  const dur = Math.max(0.5, end - b.start);
  const still = existsSync(`${galleryDir}${b.mode}.png`) ? `${galleryDir}${b.mode}.png` : blackPng;
  return { dur, still };
};

// Video: concat demuxer over per-beat stills (scaled/padded to 1920x1080).
const listLines = [];
const segArgs = [];
beats.forEach((_, i) => {
  const { dur, still } = seg(i);
  const segOut = `${outDir}_seg${i}.mp4`;
  run([
    "-y", "-loop", "1", "-i", still, "-t", dur.toFixed(3),
    "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", segOut,
  ], `seg ${i}`);
  listLines.push(`file '${segOut.replace(/'/g, "'\\''")}'`);
  segArgs.push(segOut);
});
const concatList = outDir + "_segs.txt";
writeFileSync(concatList, listLines.join("\n") + "\n");
const silentVideo = outDir + "_video.mp4";
run(["-y", "-f", "concat", "-safe", "0", "-i", concatList, "-c", "copy", silentVideo], "concat video");

// Audio: place each beat's voice MP3 at its offset with adelay, then amix. Silent if none present.
const voiceBeats = beats.filter((b) => existsSync(`${voicesDir}${b.id}.mp3`));
let audioInput = [];
if (voiceBeats.length) {
  const inputs = [];
  const filters = [];
  voiceBeats.forEach((b, k) => {
    inputs.push("-i", `${voicesDir}${b.id}.mp3`);
    const ms = Math.round(b.start * 1000);
    filters.push(`[${k}:a]adelay=${ms}|${ms}[a${k}]`);
  });
  const mix = voiceBeats.map((_, k) => `[a${k}]`).join("");
  const filter = `${filters.join(";")};${mix}amix=inputs=${voiceBeats.length}:normalize=0[aout]`;
  const audioOut = outDir + "_audio.m4a";
  run(["-y", ...inputs, "-filter_complex", filter, "-map", "[aout]",
    "-t", duration.toFixed(3), "-c:a", "aac", "-b:a", "128k", audioOut], "audio mix");
  audioInput = ["-i", audioOut];
} else {
  // No voices: generate a silent track so the MP4 always has an audio stream.
  run(["-y", "-f", "lavfi", "-t", duration.toFixed(3), "-i", "anullsrc=r=44100:cl=stereo",
    "-c:a", "aac", "-b:a", "128k", outDir + "_audio.m4a"], "silent audio");
  audioInput = ["-i", outDir + "_audio.m4a"];
}

// Final mux: video + audio, burn captions. subtitles filter needs a forward-slash, escaped path.
const srtEsc = srt.replace(/\\/g, "/").replace(/:/g, "\\:");
run([
  "-y", "-i", silentVideo, ...audioInput,
  "-vf", `subtitles='${srtEsc}':force_style='FontSize=22,Alignment=2,MarginV=40'`,
  "-map", "0:v:0", "-map", "1:a:0",
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", out,
], "final mux");

console.log(`ASSEMBLE: ${beats.length} beat(s), ${voiceBeats.length} voice track(s) -> video/out/thread-draft.mp4`);
