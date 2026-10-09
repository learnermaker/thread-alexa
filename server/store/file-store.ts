// FileStore: thread-core's Store port on local JSON files (zero-credential local run).
// <dir>/<household>.json = { version, state } ; <dir>/<household>.events.jsonl = one event per line.
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { StoreConflictError, type HouseholdState, type Store, type ThreadEvent } from "thread-core";

export function fileStore(dir: string): Store {
  const doc = (hh: string) => join(dir, `${safe(hh)}.json`);
  const log = (hh: string) => join(dir, `${safe(hh)}.events.jsonl`);
  let chain: Promise<unknown> = Promise.resolve(); // serialize commits within this process
  return {
    async load(hh) {
      const text = await readFile(doc(hh), "utf8").catch(() => undefined);
      return text ? (JSON.parse(text) as { state: HouseholdState; version: number }) : undefined;
    },
    commit(hh, state, expectedVersion, events) {
      const run = chain.then(async () => {
        await mkdir(dir, { recursive: true });
        const current = await readFile(doc(hh), "utf8").then((t) => (JSON.parse(t) as { version: number }).version, () => 0);
        if (current !== expectedVersion) throw new StoreConflictError();
        const version = current + 1;
        const tmp = `${doc(hh)}.tmp`;
        await writeFile(tmp, JSON.stringify({ version, state }));
        await rename(tmp, doc(hh)); // atomic replace
        if (events.length) await appendFile(log(hh), events.map((e) => JSON.stringify(e)).join("\n") + "\n");
        return version;
      });
      chain = run.catch(() => undefined);
      return run;
    },
    async events(hh) {
      const text = await readFile(log(hh), "utf8").catch(() => "");
      return text.split("\n").filter(Boolean).map((l) => JSON.parse(l) as ThreadEvent);
    },
  };
}

function safe(id: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(id)) throw new Error("invalid household id");
  return id;
}
