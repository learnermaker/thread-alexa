# THREAD — Terms of Service

_Last updated: 2026-10-09. This document is served at `/terms`._

THREAD is open-source software provided for a hackathon demonstration. By using
this instance or the hosted demo, you agree to these terms.

## The service

THREAD coordinates a household's shared commitments through an MCP server built
on the open-source `thread-core` engine. The demo runs with seeded composite
personas and simulated connectors (calendar, pharmacy, weather). **Nothing in
the demo places a real order, writes to a real calendar, or contacts a real
person.** Service handoffs return a confirmation request and stop there.

## Demonstration only, no warranty

This software is provided "as is", without warranty of any kind, under the
Apache License 2.0 (see `LICENSE` and `NOTICE`). It is not a production service.
Do not rely on it for real-world coordination of safety-critical or
time-critical commitments.

## Acceptable use

- Use the demo to evaluate the project.
- Do not attempt to use the authentication endpoints or stored data to act as a
  household member you are not.
- Do not submit real personal data about third parties into the demo.

## Accounts and identity

Access uses OAuth 2.1. In the demo, `DEMO_MODE` auto-consents the sign-in step
for convenience and this is disclosed in the README. Dev tokens
(`Bearer dev-<person>`) exist only for the MCP Inspector proof and automated
tests and are disabled on any AWS deployment.

## Third-party services

Optional live features call **AWS Bedrock** (agent reasoning) and **Amazon
Polly** (voice) using credentials you supply. Your use of those services is
governed by AWS's terms, not these. By default the demo uses neither.

## Changes

These terms may change as the project evolves before submission. The current
version is the one served at `/terms` and committed in this repository.

## Governing terms

The software's licence (Apache-2.0) governs your rights to the code. These terms
govern use of a running instance.
