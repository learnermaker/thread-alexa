// npm run voices: synthesize each beat's spoken line to web/public/voices/<beat>.mp3 with Amazon Polly.
// THREAD speaks in Ruth (generative); Maya and Sam get distinct voices. No credentials -> clean exit 0.
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

const story = JSON.parse(readFileSync(new URL("../story/story.json", import.meta.url), "utf8"));
const outDir = fileURLToPath(new URL("../web/public/voices/", import.meta.url));

// speaker -> Polly voice. THREAD (narrator/system/thread) = Ruth; the two people get their own.
const VOICE = { maya: "Joanna", sam: "Matthew" };
const voiceFor = (speaker) => VOICE[speaker] ?? "Ruth";

const client = new PollyClient({});

async function synth(text, voiceId) {
  const r = await client.send(new SynthesizeSpeechCommand({ Text: text, OutputFormat: "mp3", VoiceId: voiceId, Engine: "generative" }));
  const chunks = [];
  for await (const c of r.AudioStream) chunks.push(c);
  return Buffer.concat(chunks);
}

const beats = story.beats.filter((b) => b.spoken_line && b.spoken_line.trim());
mkdirSync(outDir, { recursive: true });

let done = 0;
try {
  for (const b of beats) {
    const audio = await synth(b.spoken_line, voiceFor(b.speaker));
    writeFileSync(outDir + `${b.id}.mp3`, audio);
    done++;
    console.log(`ok  ${b.id}.mp3 (${voiceFor(b.speaker)})`);
  }
  console.log(`VOICES: wrote ${done} file(s) to web/public/voices/`);
} catch (e) {
  const msg = String(e?.name === "CredentialsProviderError" || /credential|security token|region/i.test(String(e?.message)) ? e.message : e);
  console.log(`VOICES SKIPPED: no AWS credentials/region for Polly (${msg}). Playback will use the browser's speech synthesis.`);
  process.exit(0);
}
