// Fails if server/legal.ts has drifted from PRIVACY.md / TERMS.md (edit the markdown, then run gen-legal.mjs).
import { readFileSync } from "node:fs";
import { renderLegalModule } from "./gen-legal.mjs";

const want = renderLegalModule().replace(/\r\n/g, "\n");
const have = readFileSync("server/legal.ts", "utf8").replace(/\r\n/g, "\n");
if (want !== have) {
  console.error("server/legal.ts is stale. Run: node scripts/gen-legal.mjs");
  process.exit(1);
}
console.log("legal ok");
