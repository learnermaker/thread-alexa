// Watcher: on every clock change, ingests due weather signals then ticks the engine.
import type { ThreadApp } from "thread-core";
import type { WeatherSchedule } from "./weather.ts";

export interface Watcher {
  onClockChange(iso: string): Promise<void>;
}

export function createWatcher(core: ThreadApp, householdId: string, weather: WeatherSchedule): Watcher {
  const sys = { kind: "system" as const, household_id: householdId };
  return {
    async onClockChange(iso: string) {
      for (const signal of weather.due(iso)) {
        await core.ingestSignal(sys, { signal });
      }
      await core.tick(sys, {});
    },
  };
}
