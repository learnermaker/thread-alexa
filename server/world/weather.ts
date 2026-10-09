// Weather schedule: timed signals for the demo weekend. due(now) returns unfired ones.
import { toUtc } from "thread-core";

export interface WeatherSignal {
  type: "TRAVEL_TIME_CHANGED";
  place: string;
  minutes: number;
  cause: string;
  source_id: string;
}

interface ScheduledSignal { at: string; signal: WeatherSignal }

const SCHEDULE: ScheduledSignal[] = [
  {
    at: "2026-10-10T07:05:00-07:00",
    signal: { type: "TRAVEL_TIME_CHANGED", place: "place_riverside", minutes: 40, cause: "heavy rain", source_id: "wx_sat_0705" },
  },
];

export interface WeatherSchedule {
  due(now: string): WeatherSignal[];
  reset(): void;
}

export function weatherSchedule(): WeatherSchedule {
  const fired = new Set<string>();
  return {
    due(now: string) {
      const t = new Date(toUtc(now)).getTime();
      const result: WeatherSignal[] = [];
      for (const entry of SCHEDULE) {
        if (fired.has(entry.signal.source_id)) continue;
        if (new Date(toUtc(entry.at)).getTime() <= t) {
          fired.add(entry.signal.source_id);
          result.push(entry.signal);
        }
      }
      return result;
    },
    reset() { fired.clear(); },
  };
}
