import { env } from "cloudflare:workers";
import { z } from "zod";
import { type Program, getProgram, getProgramBySlug, imageUrl, parseRewards } from "./programs";
import { activeOffersFor } from "./offers";
import { activeLocation } from "./locations";
import { couponEnd, describePass, type PassView } from "./passView";
import { AppError, newCode, newId, newToken, normalizeCode, nowIso } from "./util";

export const joinInput = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: z
    .string()
    .trim()
    .max(254)
    .transform((v) => v.toLowerCase())
    .pipe(z.union([z.literal(""), z.string().email("Enter a valid email")]))
    .optional(),
  phone: z
    .string()
    .trim()
    .max(40)
    .transform((v) => v.replace(/[^\d+]/g, ""))
    .optional(),
});

interface PassRow {
  id: string;
  program_id: string;
  customer_id: string;
  token: string;
  code: string;
  stamps: number;
  points: number;
  visits_used: number;
  rewards_earned: number;
  rewards_redeemed: number;
  valid_until: string | null;
  status: "active" | "revoked";
  visit_count: number;
  last_visit_at: string | null;
  created_at: string;
}

export function viewOf(program: Program, pass: PassRow): PassView {
  return describePass(
    {
      type: program.type,
      stampGoal: program.stampGoal,
      visitLimit: program.visitLimit,
      expiresAt: program.expiresAt,
      rewards: parseRewards(program.rewards),
    },
    {
      stamps: pass.stamps,
      points: pass.points,
      visitsUsed: pass.visits_used,
      rewardsRedeemed: pass.rewards_redeemed,
      validUntil: pass.valid_until,
      status: pass.status,
    },
  );
}

/** Joins an active program; the same email or phone gets its existing pass back. Returns the pass token. */
export async function joinProgram(slug: string, input: z.infer<typeof joinInput>): Promise<string> {
  const program = await getProgramBySlug(slug);
  if (!program || program.status !== "active") throw new AppError("Not found", 404);
  const email = input.email || null;
  const phone = input.phone && input.phone.replace(/\D/g, "").length >= 5 ? input.phone : null;
  const db = env.DB;
  let customer: { id: string } | null = null;
  if (email) customer = await db.prepare("SELECT id FROM customers WHERE email = ? ORDER BY created_at LIMIT 1").bind(email).first();
  if (!customer && phone) customer = await db.prepare("SELECT id FROM customers WHERE phone = ? ORDER BY created_at LIMIT 1").bind(phone).first();
  if (customer) {
    const existing = await db
      .prepare("SELECT token FROM passes WHERE program_id = ? AND customer_id = ?")
      .bind(program.id, customer.id)
      .first<{ token: string }>();
    if (existing) return existing.token;
    await db
      .prepare("UPDATE customers SET email = COALESCE(email, ?), phone = COALESCE(phone, ?) WHERE id = ?")
      .bind(email, phone, customer.id)
      .run();
  }
  const customerId = customer?.id ?? newId();
  const token = newToken();
  const validUntil =
    program.type === "membership" && program.validDays
      ? new Date(Date.now() + program.validDays * 86400000).toISOString()
      : null;
  const statements = [];
  if (!customer) {
    statements.push(
      db.prepare("INSERT INTO customers (id, name, email, phone) VALUES (?, ?, ?, ?)").bind(customerId, input.name, email, phone),
    );
  }
  statements.push(
    db
      .prepare(
        "INSERT INTO passes (id, program_id, customer_id, token, code, valid_until) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(program_id, customer_id) DO NOTHING",
      )
      .bind(newId(), program.id, customerId, token, newCode(), validUntil),
  );
  await db.batch(statements);
  const row = await db
    .prepare("SELECT token FROM passes WHERE program_id = ? AND customer_id = ?")
    .bind(program.id, customerId)
    .first<{ token: string }>();
  return row!.token;
}

/** What the customer's pass page shows: this pass only. */
export async function publicPass(token: string) {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  const pass = await env.DB.prepare("SELECT * FROM passes WHERE token = ?").bind(token).first<PassRow>();
  if (!pass) return null;
  const program = (await getProgram(pass.program_id))!;
  const customer = await env.DB.prepare("SELECT name FROM customers WHERE id = ?").bind(pass.customer_id).first<{ name: string }>();
  return {
    pass: { code: pass.code, token: pass.token, createdAt: pass.created_at },
    customerName: customer?.name ?? "",
    view: viewOf(program, pass),
    program: programBranding(program),
    offers: (await activeOffersFor(program.id)).map(({ id, title, body, endsAt }) => ({ id, title, body, endsAt })),
  };
}

export function programBranding(program: Program) {
  return {
    name: program.name,
    type: program.type,
    rewardText: program.rewardText,
    bgColor: program.bgColor,
    textColor: program.textColor,
    logoUrl: imageUrl(program.logoKey),
    stripUrl: imageUrl(program.stripKey),
    rewards: parseRewards(program.rewards),
    stampGoal: program.stampGoal,
  };
}

/** A pass as staff see it at the counter. */
export async function scanView(passId: string) {
  const pass = await env.DB.prepare("SELECT * FROM passes WHERE id = ?").bind(passId).first<PassRow>();
  if (!pass) throw new AppError("No pass has that code.", 404);
  const program = (await getProgram(pass.program_id))!;
  const customer = await env.DB.prepare("SELECT id, name FROM customers WHERE id = ?").bind(pass.customer_id).first<{ id: string; name: string }>();
  return {
    passId: pass.id,
    code: pass.code,
    customer: { id: customer!.id, name: customer!.name },
    program: {
      id: program.id,
      name: program.name,
      type: program.type,
      rewardText: program.rewardText,
      pointsPerVisit: program.pointsPerVisit,
      pointsPerAmount: program.pointsPerAmount,
      rewards: parseRewards(program.rewards),
    },
    view: viewOf(program, pass),
  };
}

export async function lookupCode(code: string) {
  const normalized = normalizeCode(code);
  const pass = await env.DB.prepare("SELECT id FROM passes WHERE code = ?").bind(normalized).first<{ id: string }>();
  if (!pass) throw new AppError("No pass has that code.", 404);
  return scanView(pass.id);
}

export const actionInput = z
  .object({
    passId: z.string().uuid(),
    locationId: z.string().uuid().nullable(),
    action: z.enum(["stamp", "points_visit", "points_amount", "checkin", "redeem"]),
    count: z.coerce.number().int().min(1).max(100).optional(),
    amount: z.coerce.number().min(0.01).max(1000000).optional(),
    rewardId: z.string().max(40).optional(),
  })
  .strict();

const REFUSED: Record<string, string> = {
  revoked: "This pass has been cancelled.",
  usedup: "This pass has no uses left.",
  expired: "This pass has expired.",
  used: "This coupon has already been used.",
};

/** Records one action at the counter as a visit; the balance changes in the same batch. */
export async function recordAction(
  staff: { id: string; email: string },
  input: z.infer<typeof actionInput>,
) {
  const db = env.DB;
  const location = await activeLocation(input.locationId);
  const pass = await db.prepare("SELECT * FROM passes WHERE id = ?").bind(input.passId).first<PassRow>();
  if (!pass) throw new AppError("No such pass.", 404);
  const program = (await getProgram(pass.program_id))!;
  const view = viewOf(program, pass);
  if (view.state !== "ok") throw new AppError(REFUSED[view.state]!, 409);
  const now = nowIso();

  let kind: "stamp" | "points" | "checkin" | "redeem";
  let amount = 0;
  let earnedSql = "0";
  let redeemed = 0;
  let note: string | null = null;
  let guard = "status = 'active'";
  let set: string;
  let refusal = "That can't be done for this pass.";
  const goal = program.stampGoal ?? 1;

  if (input.action === "stamp" && program.type === "stamp") {
    kind = "stamp";
    amount = input.count ?? 1;
    earnedSql = `((stamps + ${amount}) / ${goal} - stamps / ${goal})`;
    set = `stamps = stamps + ${amount}, rewards_earned = rewards_earned + ${earnedSql}`;
  } else if ((input.action === "points_visit" || input.action === "points_amount") && program.type === "points") {
    kind = "points";
    amount =
      input.action === "points_visit"
        ? (program.pointsPerVisit ?? 0)
        : Math.floor((input.amount ?? 0) * (program.pointsPerAmount ?? 0));
    if (amount <= 0) throw new AppError("That adds no points.");
    note = input.action === "points_amount" ? `Spent ${input.amount}` : null;
    set = `points = points + ${amount}`;
  } else if (input.action === "checkin" && (program.type === "multivisit" || program.type === "membership")) {
    kind = "checkin";
    if (program.type === "multivisit") {
      guard += ` AND visits_used < ${program.visitLimit ?? 0}`;
      refusal = REFUSED.usedup!;
    } else {
      guard += ` AND valid_until >= '${now}'`;
      refusal = "This membership has expired.";
    }
    set = "visits_used = visits_used + 1";
  } else if (input.action === "redeem" && program.type === "stamp") {
    kind = "redeem";
    amount = goal;
    earnedSql = "0";
    redeemed = 1;
    note = program.rewardText || null;
    guard += ` AND stamps >= ${goal}`;
    refusal = "No reward is ready yet.";
    set = `stamps = stamps - ${goal}, rewards_redeemed = rewards_redeemed + 1`;
  } else if (input.action === "redeem" && program.type === "points") {
    const reward = parseRewards(program.rewards).find((r) => r.id === input.rewardId);
    if (!reward) throw new AppError("Pick a reward.");
    kind = "redeem";
    amount = reward.cost;
    earnedSql = "1";
    redeemed = 1;
    note = reward.name;
    guard += ` AND points >= ${reward.cost}`;
    refusal = "Not enough points for this reward.";
    set = `points = points - ${reward.cost}, rewards_earned = rewards_earned + 1, rewards_redeemed = rewards_redeemed + 1`;
  } else if (input.action === "redeem" && program.type === "coupon") {
    const end = couponEnd(program.expiresAt);
    if (end && end < now) throw new AppError("This coupon has expired.", 409);
    kind = "redeem";
    earnedSql = "1";
    redeemed = 1;
    note = program.rewardText || null;
    guard += " AND rewards_redeemed = 0";
    refusal = REFUSED.used!;
    set = "rewards_earned = rewards_earned + 1, rewards_redeemed = rewards_redeemed + 1";
  } else {
    throw new AppError("That action doesn't fit this program.");
  }

  const visitId = newId();
  const [, update] = await db.batch([
    db
      .prepare(
        `INSERT INTO visits (id, pass_id, program_id, customer_id, location_id, staff_user_id, staff_email, kind, amount, earned, redeemed, note, created_at)
         SELECT ?, id, program_id, customer_id, ?, ?, ?, ?, ?, ${earnedSql}, ?, ?, ? FROM passes WHERE id = ? AND ${guard}`,
      )
      .bind(visitId, location?.id ?? null, staff.id, staff.email, kind, amount, redeemed, note, now, pass.id),
    db
      .prepare(
        `UPDATE passes SET ${set}, visit_count = visit_count + 1, last_visit_at = ? WHERE id = ? AND ${guard}`,
      )
      .bind(now, pass.id),
  ]);
  if (!update?.meta.changes) throw new AppError(refusal, 409);
  return { visitId, ...(await scanView(pass.id)) };
}

const UNDO_WINDOW_MS = 10 * 60 * 1000;

interface VisitRow {
  id: string;
  pass_id: string;
  program_id: string;
  staff_user_id: string;
  kind: "stamp" | "points" | "checkin" | "redeem";
  amount: number;
  earned: number;
  redeemed: number;
  undone_at: string | null;
  created_at: string;
}

/** Reverses a visit. Members undo only their own latest one within 10 minutes; admins any. */
export async function undoVisit(user: { id: string }, admin: boolean, visitId: string) {
  const db = env.DB;
  const visit = await db.prepare("SELECT * FROM visits WHERE id = ?").bind(visitId).first<VisitRow>();
  if (!visit) throw new AppError("No such visit.", 404);
  if (visit.undone_at) throw new AppError("Already undone.", 409);
  if (!admin) {
    const latest = await db
      .prepare("SELECT id FROM visits WHERE pass_id = ? AND undone_at IS NULL ORDER BY created_at DESC, rowid DESC LIMIT 1")
      .bind(visit.pass_id)
      .first<{ id: string }>();
    const fresh = Date.now() - Date.parse(visit.created_at) <= UNDO_WINDOW_MS;
    if (visit.staff_user_id !== user.id || !fresh || latest?.id !== visit.id) {
      throw new AppError("You can undo only your own last action, within 10 minutes.", 403);
    }
  }
  const program = (await getProgram(visit.program_id))!;
  const a = visit.amount;
  let set: string;
  let guard = "1 = 1";
  switch (visit.kind) {
    case "stamp":
      set = `stamps = stamps - ${a}, rewards_earned = MAX(rewards_earned - ${visit.earned}, 0)`;
      guard = `stamps >= ${a}`;
      break;
    case "points":
      set = `points = points - ${a}`;
      guard = `points >= ${a}`;
      break;
    case "checkin":
      set = "visits_used = MAX(visits_used - 1, 0)";
      break;
    case "redeem":
      set = `${program.type === "stamp" ? `stamps = stamps + ${a}, ` : program.type === "points" ? `points = points + ${a}, ` : ""}rewards_earned = MAX(rewards_earned - ${visit.earned}, 0), rewards_redeemed = MAX(rewards_redeemed - 1, 0)`;
      break;
  }
  const now = nowIso();
  const [update, mark] = await db.batch([
    db
      .prepare(
        `UPDATE passes SET ${set}, visit_count = MAX(visit_count - 1, 0) WHERE id = ? AND ${guard} AND EXISTS (SELECT 1 FROM visits WHERE id = ? AND undone_at IS NULL)`,
      )
      .bind(visit.pass_id, visit.id),
    db
      .prepare("UPDATE visits SET undone_at = ?, undone_by = ? WHERE id = ? AND undone_at IS NULL AND changes() > 0")
      .bind(now, user.id, visit.id),
  ]);
  if (!mark?.meta.changes) {
    if (!update?.meta.changes) throw new AppError("This can't be undone: the balance has changed since.", 409);
    throw new AppError("Already undone.", 409);
  }
  return scanView(visit.pass_id);
}
