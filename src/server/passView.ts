// How a pass reads: its balance, its state and what it can do next. Shared by
// the customer's pass page and the scanner, so both say the same thing.
import type { ProgramType, Reward } from "./programs";

export interface PassFacts {
  stamps: number;
  points: number;
  visitsUsed: number;
  rewardsRedeemed: number;
  validUntil: string | null;
  status: "active" | "revoked";
}

export interface ProgramFacts {
  type: ProgramType;
  stampGoal: number | null;
  visitLimit: number | null;
  expiresAt: string | null;
  rewards: Reward[];
}

export type PassState = "ok" | "usedup" | "expired" | "used" | "revoked";

export interface PassView {
  balance: string;
  state: PassState;
  stateLabel: string | null;
  rewardsReady: number;
  progress: { value: number; max: number } | null;
}

const STATE_LABEL: Record<PassState, string | null> = {
  ok: null,
  usedup: "Used up",
  expired: "Expired",
  used: "Used",
  revoked: "Cancelled",
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The end of a coupon's expiry day, as an ISO timestamp. */
export function couponEnd(expiresAt: string | null): string | null {
  return expiresAt ? `${expiresAt}T23:59:59.999Z` : null;
}

export function describePass(program: ProgramFacts, pass: PassFacts, now = new Date().toISOString()): PassView {
  let view: Omit<PassView, "stateLabel">;
  switch (program.type) {
    case "stamp": {
      const goal = program.stampGoal ?? 1;
      view = {
        balance: `${pass.stamps} / ${goal} stamps`,
        state: "ok",
        rewardsReady: Math.floor(pass.stamps / goal),
        progress: { value: Math.min(pass.stamps, goal), max: goal },
      };
      break;
    }
    case "points": {
      const costs = program.rewards.map((r) => r.cost).sort((a, b) => a - b);
      const next = costs.find((c) => c > pass.points) ?? costs[0] ?? 0;
      view = {
        balance: `${pass.points} points`,
        state: "ok",
        rewardsReady: program.rewards.filter((r) => r.cost <= pass.points).length,
        progress: next ? { value: Math.min(pass.points, next), max: next } : null,
      };
      break;
    }
    case "multivisit": {
      const limit = program.visitLimit ?? 0;
      const left = Math.max(limit - pass.visitsUsed, 0);
      view = {
        balance: left === 0 ? "No uses left" : `${left} ${left === 1 ? "use" : "uses"} left`,
        state: left === 0 ? "usedup" : "ok",
        rewardsReady: 0,
        progress: { value: left, max: limit },
      };
      break;
    }
    case "membership": {
      const expired = !pass.validUntil || pass.validUntil < now;
      view = {
        balance: pass.validUntil ? `Valid until ${formatDate(pass.validUntil)}` : "Expired",
        state: expired ? "expired" : "ok",
        rewardsReady: 0,
        progress: null,
      };
      break;
    }
    case "coupon": {
      const end = couponEnd(program.expiresAt);
      const used = pass.rewardsRedeemed > 0;
      const expired = !used && end !== null && end < now;
      view = {
        balance: used ? "Used" : expired ? "Expired" : "Ready to use",
        state: used ? "used" : expired ? "expired" : "ok",
        rewardsReady: used || expired ? 0 : 1,
        progress: null,
      };
      break;
    }
  }
  if (pass.status === "revoked") view = { ...view, state: "revoked", rewardsReady: 0 };
  return { ...view, stateLabel: STATE_LABEL[view.state] };
}
