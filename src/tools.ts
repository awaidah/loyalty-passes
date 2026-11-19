// The app's tools for AI clients. The Gateway serves them at /mcp and calls
// each with the signed-in member.
import { defineTools } from "@every-app/sdk/server";
import { z } from "zod";
import { listCustomers, listInput } from "@/server/customers";
import { getStats, statsInput } from "@/server/stats";
import { listPrograms, parseRewards } from "@/server/programs";

export const tools = defineTools({
  list_programs: {
    description: "List the loyalty programs with their type, rules and status.",
    risk: "read",
    input: z.object({}).strict(),
    handler: async () =>
      (await listPrograms()).map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        status: p.status,
        reward: p.rewardText,
        stampGoal: p.stampGoal,
        pointsPerVisit: p.pointsPerVisit,
        pointsPerAmount: p.pointsPerAmount,
        rewards: parseRewards(p.rewards),
        visitLimit: p.visitLimit,
        validDays: p.validDays,
        expiresAt: p.expiresAt,
      })),
  },
  search_customers: {
    description: "Search customers by name, email or phone, with their passes, balances and visit counts. 25 per page.",
    risk: "read",
    input: listInput,
    handler: (input) => listCustomers(input),
  },
  loyalty_stats: {
    description: "New passes, visits, rewards earned and redeemed, and the repeat-customer share over the last 7, 30 or 90 days, optionally for one program or location id.",
    risk: "read",
    input: statsInput,
    handler: (input) => getStats(input),
  },
});
