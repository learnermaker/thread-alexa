// DEMO_MODE clock: starts at DEMO_START and moves with real time; set() jumps (e.g. "jump to Sat 07:05").
// (thread-core never reads time itself; this adapter is the only place that does.)
import { toUtc, type Clock } from "thread-core";

export interface DemoClock extends Clock { set(iso: string): void }
export function demoClock(startIso: string, realNow: () => number = Date.now): DemoClock {
  let base = Date.parse(toUtc(startIso));
  let since = realNow();
  return {
    now: () => new Date(base + (realNow() - since)).toISOString(),
    set: (iso) => { base = Date.parse(toUtc(iso)); since = realNow(); },
  };
}
