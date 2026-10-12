// Fails if package.json dependencies differ from the approved, pinned list (architect-owned; updated per spec).
import { readFileSync } from "node:fs";

const approved = {
  dependencies: {
    "@aws-sdk/client-bedrock-runtime": "3.1147.0",
    "@aws-sdk/client-dynamodb": "3.1147.0",
    "@aws-sdk/client-polly": "3.1147.0",
    "@aws-sdk/lib-dynamodb": "3.1147.0",
    "@hono/node-server": "2.1.4",
    "@modelcontextprotocol/ext-apps": "1.7.5",
    "@modelcontextprotocol/sdk": "1.32.1",
    hono: "4.13.13",
    jose: "6.2.12",
    react: "19.3.0",
    "react-dom": "19.3.0",
    "thread-core": "https://github.com/learnermaker/thread-core/releases/download/v0.1.0/thread-core-0.1.0.tgz",
    zod: "4.6.5",
  },
  devDependencies: {
    "@playwright/test": "1.64.0",
    "@types/aws-lambda": "8.10.164",
    "@types/node": "24.19.1",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "6.1.2",
    "aws-cdk": "2.1145.0",
    "aws-cdk-lib": "2.272.0",
    constructs: "10.8.1",
    esbuild: "0.28.2",
    "ffmpeg-static": "5.3.0",
    typescript: "5.9.3",
    vite: "8.3.4",
    "vite-plugin-singlefile": "2.3.3",
    vitest: "5.0.3",
  },
};
// Approved = the list above. Each package is OPTIONAL until a spec installs it (always with --save-exact).
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const problems = [];
for (const field of ["dependencies", "devDependencies"]) {
  const want = approved[field];
  const have = pkg[field] ?? {};
  for (const [name, v] of Object.entries(have)) if (want[name] !== v) problems.push(`${field}.${name}@${v} is not approved`);
  for (const [name, v] of Object.entries(have)) if (want[name] && want[name] !== v) problems.push(`${field}.${name} must be exactly ${want[name]}`);
}
if (problems.length) {
  console.error(`Dependency allowlist violated (new deps need an architect decision):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("deps ok");
