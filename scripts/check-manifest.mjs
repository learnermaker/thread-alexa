// Fails if addon-manifest.example.json violates the documented Alexa+ manifest limits (Master Spec B6):
// name <= 30, shortDescription <= 123, 3-4 example phrases, icons at 72/64/88/126/180/241 px.
import { readFileSync } from "node:fs";

const m = JSON.parse(readFileSync("addon-manifest.example.json", "utf8"));
const errs = [];
if (!m.name || m.name.length > 30) errs.push(`name length ${m.name?.length}`);
if (!m.shortDescription || m.shortDescription.length > 123) errs.push(`shortDescription length ${m.shortDescription?.length}`);
if (!Array.isArray(m.examplePhrases) || m.examplePhrases.length < 3 || m.examplePhrases.length > 4) errs.push(`examplePhrases count ${m.examplePhrases?.length}`);
for (const px of ["72", "64", "88", "126", "180", "241"]) if (!m.icons?.[px]) errs.push(`missing icon ${px}`);
if (errs.length) {
  console.error(`addon-manifest.example.json violates B6 limits:\n  ${errs.join("\n  ")}`);
  process.exit(1);
}
console.log("manifest ok");
