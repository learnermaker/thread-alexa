// Generates server/legal.ts from PRIVACY.md and TERMS.md so the served /privacy and /terms
// pages never drift from the repo's legal docs. Run: node scripts/gen-legal.mjs
// scripts/check-legal.mjs (in npm run verify) re-runs this in memory and fails on drift.
import { readFileSync, writeFileSync } from "node:fs";

export function renderLegalModule() {
  const privacy = readFileSync("PRIVACY.md", "utf8");
  const terms = readFileSync("TERMS.md", "utf8");
  const lit = (s) => "`" + s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${") + "`";
  return `// Legal pages served at /privacy and /terms (the Alexa+ add-on manifest requires HTTPS URLs for both; D18.10).
// GENERATED from PRIVACY.md and TERMS.md by scripts/gen-legal.mjs — do not edit by hand; edit the markdown.
// Inlined as strings (not runtime file reads) so the Lambda esbuild bundle carries them with no file dependency.
export const PRIVACY_MD = ${lit(privacy)};

export const TERMS_MD = ${lit(terms)};

function page(title: string, md: string) {
  const safe = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return \`<!doctype html><html lang="en"><head><meta charset="utf-8">\` +
    \`<meta name="viewport" content="width=device-width,initial-scale=1">\` +
    \`<title>\${title} — THREAD</title>\` +
    \`<style>body{font:16px/1.6 system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#1a1a2e}pre{white-space:pre-wrap;word-wrap:break-word;font:inherit}</style>\` +
    \`</head><body><pre>\${safe}</pre></body></html>\`;
}

export const privacyHtml = () => page("Privacy", PRIVACY_MD);
export const termsHtml = () => page("Terms", TERMS_MD);
`;
}

// When run directly, write the file.
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].endsWith("gen-legal.mjs")) {
  writeFileSync("server/legal.ts", renderLegalModule());
  console.log("wrote server/legal.ts");
}
