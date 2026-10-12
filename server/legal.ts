// Legal pages served at /privacy and /terms (the Alexa+ add-on manifest requires HTTPS URLs for both; D18.10).
// GENERATED from PRIVACY.md and TERMS.md by scripts/gen-legal.mjs — do not edit by hand; edit the markdown.
// Inlined as strings (not runtime file reads) so the Lambda esbuild bundle carries them with no file dependency.
export const PRIVACY_MD = `# THREAD — Privacy Policy

_Last updated: 2026-10-09. This document is served at \`/privacy\`._

THREAD is a coordination layer for a household's shared commitments. This policy
explains what THREAD processes, why, and the choices you have. It describes the
behaviour of the software in this repository, including the hosted demo.

## What this covers

THREAD is a self-hosted MCP (Model Context Protocol) server built on the
open-source \`thread-core\` engine. It is operated by whoever deploys it — in the
hackathon demo, that is the project team. If your household runs its own
instance, that household is the data controller and this policy is a template
you should adapt.

## What we process

- **Household and member records** you create: names, display names, and which
  members have an account. These come from the seed fixture in the demo
  (\`fixtures/golden/rivera-seed.json\`); they are composite personas, not real
  people.
- **Threads and their contents**: the commitment, event time and place,
  participants, responsibilities, derived conditions, handoffs, and evidence.
- **Change reports** (for example "I can't drive Saturday morning") used to
  compute what a change affects.
- **Operational logs**: per-request tool name, latency and result code, kept in
  memory and capped (the demo keeps the last 200 calls). No request bodies are
  logged.

THREAD does **not** process payment card data, biometric data, or precise
location. Service "purchases" in the demo are simulated and order nothing.

## Why we process it

- To derive what a change affects, who can act, and whether a commitment is
  resolved — the product's sole purpose.
- To enforce identity: a member can only report their own availability, answer
  their own handoffs, and approve their own purchases. Identity comes from the
  authenticated session (an OAuth token), never from what a request claims.

## Minimum necessary context

When responsibility moves between people, THREAD shares only the fields the
recipient needs to act. Every handoff returns a **Context Receipt** listing what
was shared and what was withheld. This is a core design guarantee, not a
setting.

## Retention

- Demo instances use an on-disk FileStore (local) or DynamoDB (deployed) and are
  reset between demos. There is no long-term profile building.
- Operational logs are in-memory and lost on restart.

## Sharing

THREAD does not sell data and has no advertising. In the demo, no data leaves
the instance except calls you make to AWS Bedrock and Amazon Polly **only if you
enable the optional live agent and voice features** with your own AWS
credentials; by default the demo runs fully offline with a scripted agent.

## Your choices

- Run entirely offline with zero credentials (\`npm run demo\`): no external calls.
- Delete all demo data with the simulator's reset action or by clearing the
  data directory.

## Children

The demo personas include a minor as **subject matter** (a child's tournament).
THREAD does not create accounts for, or collect data from, children: only adult
household members have accounts and act in the system.

## Contact

This is a hackathon project. Questions go through the GitHub repository's issues:
<https://github.com/learnermaker/thread-alexa>.
`;

export const TERMS_MD = `# THREAD — Terms of Service

_Last updated: 2026-10-09. This document is served at \`/terms\`._

THREAD is open-source software provided for a hackathon demonstration. By using
this instance or the hosted demo, you agree to these terms.

## The service

THREAD coordinates a household's shared commitments through an MCP server built
on the open-source \`thread-core\` engine. The demo runs with seeded composite
personas and simulated connectors (calendar, pharmacy, weather). **Nothing in
the demo places a real order, writes to a real calendar, or contacts a real
person.** Service handoffs return a confirmation request and stop there.

## Demonstration only, no warranty

This software is provided "as is", without warranty of any kind, under the
Apache License 2.0 (see \`LICENSE\` and \`NOTICE\`). It is not a production service.
Do not rely on it for real-world coordination of safety-critical or
time-critical commitments.

## Acceptable use

- Use the demo to evaluate the project.
- Do not attempt to use the authentication endpoints or stored data to act as a
  household member you are not.
- Do not submit real personal data about third parties into the demo.

## Accounts and identity

Access uses OAuth 2.1. In the demo, \`DEMO_MODE\` auto-consents the sign-in step
for convenience and this is disclosed in the README. Dev tokens
(\`Bearer dev-<person>\`) exist only for the MCP Inspector proof and automated
tests and are disabled on any AWS deployment.

## Third-party services

Optional live features call **AWS Bedrock** (agent reasoning) and **Amazon
Polly** (voice) using credentials you supply. Your use of those services is
governed by AWS's terms, not these. By default the demo uses neither.

## Changes

These terms may change as the project evolves before submission. The current
version is the one served at \`/terms\` and committed in this repository.

## Governing terms

The software's licence (Apache-2.0) governs your rights to the code. These terms
govern use of a running instance.
`;

function page(title: string, md: string) {
  const safe = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${title} — THREAD</title>` +
    `<style>body{font:16px/1.6 system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#1a1a2e}pre{white-space:pre-wrap;word-wrap:break-word;font:inherit}</style>` +
    `</head><body><pre>${safe}</pre></body></html>`;
}

export const privacyHtml = () => page("Privacy", PRIVACY_MD);
export const termsHtml = () => page("Terms", TERMS_MD);
