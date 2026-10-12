# THREAD — Privacy Policy

_Last updated: 2026-10-09. This document is served at `/privacy`._

THREAD is a coordination layer for a household's shared commitments. This policy
explains what THREAD processes, why, and the choices you have. It describes the
behaviour of the software in this repository, including the hosted demo.

## What this covers

THREAD is a self-hosted MCP (Model Context Protocol) server built on the
open-source `thread-core` engine. It is operated by whoever deploys it — in the
hackathon demo, that is the project team. If your household runs its own
instance, that household is the data controller and this policy is a template
you should adapt.

## What we process

- **Household and member records** you create: names, display names, and which
  members have an account. These come from the seed fixture in the demo
  (`fixtures/golden/rivera-seed.json`); they are composite personas, not real
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

- Run entirely offline with zero credentials (`npm run demo`): no external calls.
- Delete all demo data with the simulator's reset action or by clearing the
  data directory.

## Children

The demo personas include a minor as **subject matter** (a child's tournament).
THREAD does not create accounts for, or collect data from, children: only adult
household members have accounts and act in the system.

## Contact

This is a hackathon project. Questions go through the GitHub repository's issues:
<https://github.com/learnermaker/thread-alexa>.
