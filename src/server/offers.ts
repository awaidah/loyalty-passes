import { env } from "cloudflare:workers";
import { z } from "zod";
import { AppError, newId, nowIso } from "./util";

export const offerInput = z
  .object({
    programId: z.string().uuid().nullable(),
    title: z.string().trim().min(1, "Title is required").max(80),
    body: z.string().trim().min(1, "Message is required").max(500),
    startsAt: z.string().datetime().nullable(),
    endsAt: z.string().datetime().nullable(),
  })
  .strict()
  .refine((o) => !o.endsAt || !o.startsAt || o.endsAt > o.startsAt, "The end must come after the start");

export interface Offer {
  id: string;
  programId: string | null;
  programName: string | null;
  title: string;
  body: string;
  startsAt: string;
  endsAt: string | null;
  status: "scheduled" | "active" | "ended";
}

export function offerStatus(startsAt: string, endsAt: string | null, now = nowIso()): Offer["status"] {
  if (endsAt && endsAt <= now) return "ended";
  if (startsAt > now) return "scheduled";
  return "active";
}

export async function listOffers(): Promise<Offer[]> {
  const { results } = await env.DB.prepare(
    `SELECT o.id, o.program_id, p.name AS program_name, o.title, o.body, o.starts_at, o.ends_at
     FROM offers o LEFT JOIN programs p ON p.id = o.program_id ORDER BY o.starts_at DESC`,
  ).all<Record<string, string | null>>();
  const now = nowIso();
  return results.map((r) => ({
    id: r.id!,
    programId: r.program_id ?? null,
    programName: r.program_name ?? null,
    title: r.title!,
    body: r.body!,
    startsAt: r.starts_at!,
    endsAt: r.ends_at ?? null,
    status: offerStatus(r.starts_at!, r.ends_at ?? null, now),
  }));
}

export async function createOffer(userId: string, input: z.infer<typeof offerInput>) {
  if (input.programId) {
    const exists = await env.DB.prepare("SELECT 1 FROM programs WHERE id = ?").bind(input.programId).first();
    if (!exists) throw new AppError("No such program.", 404);
  }
  const startsAt = input.startsAt ?? nowIso();
  if (input.endsAt && input.endsAt <= startsAt) throw new AppError("The end must come after the start.");
  await env.DB.prepare(
    "INSERT INTO offers (id, program_id, title, body, starts_at, ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(newId(), input.programId, input.title, input.body, startsAt, input.endsAt, userId)
    .run();
}

export async function endOffer(id: string) {
  const now = nowIso();
  const result = await env.DB.prepare(
    "UPDATE offers SET ends_at = ?, starts_at = MIN(starts_at, ?) WHERE id = ? AND (ends_at IS NULL OR ends_at > ?)",
  )
    .bind(now, now, id, now)
    .run();
  if (!result.meta.changes) throw new AppError("That offer has already ended.", 409);
}

export async function activeOffersFor(programId: string) {
  const now = nowIso();
  const { results } = await env.DB.prepare(
    `SELECT id, title, body, ends_at FROM offers
     WHERE (program_id IS NULL OR program_id = ?) AND starts_at <= ? AND (ends_at IS NULL OR ends_at > ?)
     ORDER BY starts_at DESC`,
  )
    .bind(programId, now, now)
    .all<{ id: string; title: string; body: string; ends_at: string | null }>();
  return results.map((r) => ({ id: r.id, title: r.title, body: r.body, endsAt: r.ends_at }));
}
