import { env } from "cloudflare:workers";
import { z } from "zod";

export const statsInput = z.object({
  range: z.coerce.number().pipe(z.union([z.literal(7), z.literal(30), z.literal(90)])).catch(30),
  programId: z.string().uuid().optional().catch(undefined),
  locationId: z.string().uuid().optional().catch(undefined),
});

export async function getStats(input: z.infer<typeof statsInput>) {
  const db = env.DB;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (input.range - 1));
  const since = start.toISOString();

  const vWhere = ["v.undone_at IS NULL", "v.created_at >= ?"];
  const vBind: unknown[] = [since];
  if (input.programId) (vWhere.push("v.program_id = ?"), vBind.push(input.programId));
  if (input.locationId) (vWhere.push("v.location_id = ?"), vBind.push(input.locationId));
  const visitWhere = vWhere.join(" AND ");

  const pWhere = ["p.created_at >= ?"];
  const pBind: unknown[] = [since];
  if (input.programId) (pWhere.push("p.program_id = ?"), pBind.push(input.programId));
  if (input.locationId) {
    pWhere.push("EXISTS (SELECT 1 FROM visits x WHERE x.pass_id = p.id AND x.location_id = ? AND x.undone_at IS NULL)");
    pBind.push(input.locationId);
  }
  const passWhere = pWhere.join(" AND ");

  const [totals, passes, repeat, visitDays, passDays] = await db.batch([
    db
      .prepare(`SELECT COUNT(*) AS visits, COALESCE(SUM(v.earned), 0) AS earned, COALESCE(SUM(v.redeemed), 0) AS redeemed FROM visits v WHERE ${visitWhere}`)
      .bind(...vBind),
    db.prepare(`SELECT COUNT(*) AS n FROM passes p WHERE ${passWhere}`).bind(...pBind),
    db
      .prepare(
        `SELECT COUNT(*) AS customers, COALESCE(SUM(n > 1), 0) AS repeaters FROM (SELECT v.customer_id, COUNT(*) AS n FROM visits v WHERE ${visitWhere} GROUP BY v.customer_id)`,
      )
      .bind(...vBind),
    db
      .prepare(
        `SELECT substr(v.created_at, 1, 10) AS day, COUNT(*) AS visits, SUM(v.earned) AS earned, SUM(v.redeemed) AS redeemed FROM visits v WHERE ${visitWhere} GROUP BY day`,
      )
      .bind(...vBind),
    db.prepare(`SELECT substr(p.created_at, 1, 10) AS day, COUNT(*) AS passes FROM passes p WHERE ${passWhere} GROUP BY day`).bind(...pBind),
  ]);
  const t = (totals!.results[0] ?? {}) as { visits: number; earned: number; redeemed: number };
  const r = (repeat!.results[0] ?? {}) as { customers: number; repeaters: number };
  const byDay = new Map<string, { visits: number; earned: number; redeemed: number; passes: number }>();
  for (let i = 0; i < input.range; i++) {
    const d = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
    byDay.set(d, { visits: 0, earned: 0, redeemed: 0, passes: 0 });
  }
  for (const row of visitDays!.results as { day: string; visits: number; earned: number; redeemed: number }[]) {
    const d = byDay.get(row.day);
    if (d) Object.assign(d, { visits: row.visits, earned: row.earned, redeemed: row.redeemed });
  }
  for (const row of passDays!.results as { day: string; passes: number }[]) {
    const d = byDay.get(row.day);
    if (d) d.passes = row.passes;
  }
  return {
    range: input.range,
    totals: {
      passes: (passes!.results[0] as { n: number }).n,
      visits: t.visits ?? 0,
      earned: t.earned ?? 0,
      redeemed: t.redeemed ?? 0,
      repeatShare: r.customers ? Math.round((r.repeaters / r.customers) * 100) : null,
    },
    series: [...byDay].map(([day, v]) => ({ day, ...v })),
  };
}
