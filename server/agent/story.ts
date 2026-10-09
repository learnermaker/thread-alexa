// story.json — the E1 beat script that drives the scripted agent, "Play the story" and the e2e.
import { readFileSync } from "node:fs";

export interface Beat {
  id: string;
  clock: string;
  device: "echo" | "phone";
  speaker: string;
  utterance: string;
  tool_calls: Array<{ name: string; args: Record<string, unknown> }>;
  expected_lens_mode: string;
  spoken_line: string;
}
export interface Story { description: string; beats: Beat[] }

export function loadStory(): Story {
  return JSON.parse(readFileSync(new URL("../../story/story.json", import.meta.url), "utf8")) as Story;
}

/** Normalise an utterance for matching: lowercase, drop punctuation, collapse spaces. */
export const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();

/** The first beat whose (non-empty) utterance matches the text, either way as a substring. */
export function matchBeat(story: Story, text: string): Beat | undefined {
  const t = norm(text);
  if (!t) return undefined;
  return story.beats.find((b) => {
    if (!b.utterance) return false;
    const u = norm(b.utterance);
    return u === t || u.includes(t) || t.includes(u);
  });
}
