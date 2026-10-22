// Demo pharmacy connector: seeded quote, scripted delivery at a fixed time.
import { toUtc, type Clock, type ServiceProvider } from "thread-core";

export interface PharmacyConfig {
  id: string;
  name: string;
  handles: string[];
  quote: { slot: { start: string; end: string }; amount_cents: number; currency: "USD" };
  delivered_at: string;
}

export interface DemoPharmacy extends ServiceProvider {
  orders: Map<string, string>;
  reset(): void;
}

let orderSeq = 0;

export function demoPharmacy(cfg: PharmacyConfig, clock: Clock): DemoPharmacy {
  const orders = new Map<string, string>();
  return {
    id: cfg.id,
    name: cfg.name,
    handles: cfg.handles,
    orders,
    async query() {
      return {
        provider_id: cfg.id,
        slot: { start: toUtc(cfg.quote.slot.start), end: toUtc(cfg.quote.slot.end) },
        amount_cents: cfg.quote.amount_cents,
        currency: cfg.quote.currency,
        summary: cfg.name, // thread-core appends the slot and the price when it words the confirmation
      };
    },
    async act(input) {
      const order_id = `ord_${++orderSeq}`;
      orders.set(input.order_ref, order_id);
      return { order_id };
    },
    async verify(input) {
      const now = new Date(clock.now()).getTime();
      const delivered = new Date(toUtc(cfg.delivered_at)).getTime();
      if (now >= delivered) return { state: "DELIVERED" as const, delivered_at: toUtc(cfg.delivered_at) };
      return { state: "PLACED" as const };
    },
    reset() { orders.clear(); orderSeq = 0; },
  };
}

function fmtSlot(start: string, end: string): string {
  const fmt = (iso: string) => {
    const d = new Date(toUtc(iso));
    const h = d.getUTCHours() - 7; // America/Los_Angeles offset (Oct = PDT = UTC-7)
    const m = d.getUTCMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return m ? `${h12}:${String(m).padStart(2, "0")} ${ampm}` : `${h12}:00 ${ampm}`;
  };
  return `Saturday ${fmt(start)}\u2013${fmt(end)}`;
}
