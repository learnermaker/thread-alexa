// Demo calendar connector: in-memory blocks per person, idempotent per ref.
import type { CalendarConnector } from "thread-core";

export interface DemoBlock { person_id: string; title: string; start: string; end: string; ref: string; block_id: string }

export interface DemoCalendar extends CalendarConnector {
  blocks: Map<string, DemoBlock>;
  reset(): void;
}

export function demoCalendar(): DemoCalendar {
  const blocks = new Map<string, DemoBlock>();
  return {
    blocks,
    async createBlock(input) {
      const block_id = `cal_${input.ref}`;
      blocks.set(block_id, { ...input, block_id });
      return { block_id };
    },
    async moveBlock(input) {
      const b = blocks.get(input.block_id);
      if (b) { b.start = input.start; b.end = input.end; }
    },
    async verifyBlock(input) {
      const b = blocks.get(input.block_id);
      return !!b && b.start === input.start && b.end === input.end;
    },
    reset() { blocks.clear(); },
  };
}
