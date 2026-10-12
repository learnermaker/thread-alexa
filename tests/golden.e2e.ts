// Golden e2e (Master Spec D14): a fresh demo, "Play the story", then assert the Lens visited
// each beat's expected mode in order and the end state is Tournament RESOLVED, Refill RESOLVED,
// Dinner PLAN_SECURED. Drives the REAL demo server + scripted agent over MCP — nothing is mocked.
import { expect, test } from "@playwright/test";

test("Play the story reaches every beat's Lens mode and the resolved end state", async ({ page }) => {
  await page.goto("/");

  // The expected per-beat mode sequence comes from the same story the player uses.
  const story = await (await page.request.get("/api/story")).json();
  const expectedModes: string[] = story.beats.map((b: { expected_lens_mode: string }) => b.expected_lens_mode);

  // Record every distinct data-lens-mode the stage shows while the story plays.
  await page.evaluate(() => {
    const w = window as unknown as { __modes: string[] };
    w.__modes = [];
    const stage = document.querySelector(".stage")!;
    const push = () => {
      const m = stage.getAttribute("data-lens-mode") ?? "";
      if (m && w.__modes[w.__modes.length - 1] !== m) w.__modes.push(m);
    };
    push();
    new MutationObserver(push).observe(stage, { attributes: true, attributeFilter: ["data-lens-mode"] });
  });

  await page.waitForSelector('[data-testid="play-story"]:not([disabled])');
  await page.getByTestId("play-story").click();

  // Play runs ~90s; wait for the button to re-enable (play finished).
  await expect(page.getByTestId("play-story")).toBeEnabled({ timeout: 120_000 });

  // The visited modes must be the beat sequence as a subsequence (collapsing repeats).
  const visited: string[] = await page.evaluate(() => (window as unknown as { __modes: string[] }).__modes);
  const wantSeq = expectedModes.filter((m, i) => m !== expectedModes[i - 1]);
  let j = 0;
  for (const m of visited) if (m === wantSeq[j]) j++;
  expect(j, `visited modes ${visited.join(",")} must cover ${wantSeq.join(",")}`).toBe(wantSeq.length);

  // The ripple, receipt, secured and resolved modes must all have been shown.
  for (const must of ["RIPPLE", "RECEIPT", "SECURED", "RESOLVED", "CAROUSEL"]) {
    expect(visited, `mode ${must}`).toContain(must);
  }

  // End state via the final list_threads spoken line in the Echo transcript.
  const transcript = (await page.getByTestId("echo-transcript").innerText()).toLowerCase();
  expect(transcript).toContain("leo's saturday tournament (done)");
  expect(transcript).toContain("rosa's prescription refill (done)");
  expect(transcript).toContain("family dinner (plan secured)");
});
