// Phase 7: the legal pages the Alexa+ add-on manifest points at must be served (D18.10).
import { afterAll, beforeAll, expect, test } from "vitest";
import { startServer, type TestServer } from "./harness.ts";

let srv: TestServer;
beforeAll(async () => { srv = await startServer(); });
afterAll(async () => { await srv.close(); });

test("/privacy serves the privacy policy as HTML", async () => {
  const res = await fetch(`${srv.base}/privacy`);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/html");
  const body = await res.text();
  expect(body).toContain("THREAD");
  expect(body).toContain("Privacy Policy");
});

test("/terms serves the terms of service as HTML", async () => {
  const res = await fetch(`${srv.base}/terms`);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/html");
  const body = await res.text();
  expect(body).toContain("Terms of Service");
});
