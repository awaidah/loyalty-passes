import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { programs } from "@/db/schema";
import { AppError, newCode, newId, nowIso } from "./util";

export const PROGRAM_TYPES = ["stamp", "points", "multivisit", "membership", "coupon"] as const;
export type ProgramType = (typeof PROGRAM_TYPES)[number];

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour");
const count = z.coerce.number().int().min(1).max(100000);

export const programInput = z
  .object({
    type: z.enum(PROGRAM_TYPES),
    name: z.string().trim().min(1, "Name is required").max(80),
    rewardText: z.string().trim().max(300).default(""),
    stampGoal: count.nullish(),
    pointsPerVisit: z.coerce.number().int().min(0).max(100000).nullish(),
    pointsPerAmount: z.coerce.number().int().min(0).max(100000).nullish(),
    rewards: z
      .array(z.object({ id: z.string().max(40).optional(), name: z.string().trim().min(1).max(80), cost: count }))
      .max(20)
      .default([]),
    visitLimit: count.nullish(),
    validDays: count.nullish(),
    expiresAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullish()
      .or(z.literal("").transform(() => null)),
    bgColor: color,
    textColor: color,
  })
  .strict()
  .superRefine((p, ctx) => {
    const need = (ok: unknown, message: string) => {
      if (!ok) ctx.addIssue({ code: "custom", message });
    };
    if (p.type === "stamp") need(p.stampGoal, "Set how many stamps earn the reward");
    if (p.type === "points") {
      need((p.pointsPerVisit ?? 0) > 0 || (p.pointsPerAmount ?? 0) > 0, "Set points per visit or per amount spent");
      need(p.rewards.length > 0, "Add at least one reward");
    }
    if (p.type === "multivisit") need(p.visitLimit, "Set the number of uses");
    if (p.type === "membership") need(p.validDays, "Set how many days a membership lasts");
  });
export type ProgramInput = z.infer<typeof programInput>;

export interface Reward {
  id: string;
  name: string;
  cost: number;
}

export type Program = typeof programs.$inferSelect;

export function parseRewards(json: string): Reward[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function columns(input: ProgramInput) {
  const t = input.type;
  return {
    type: t,
    name: input.name,
    rewardText: input.rewardText,
    stampGoal: t === "stamp" ? input.stampGoal! : null,
    pointsPerVisit: t === "points" ? (input.pointsPerVisit ?? 0) : null,
    pointsPerAmount: t === "points" ? (input.pointsPerAmount ?? 0) : null,
    rewards: JSON.stringify(
      t === "points" ? input.rewards.map((r) => ({ id: r.id || newId().slice(0, 8), name: r.name, cost: r.cost })) : [],
    ),
    visitLimit: t === "multivisit" ? input.visitLimit! : null,
    validDays: t === "membership" ? input.validDays! : null,
    expiresAt: t === "coupon" ? (input.expiresAt ?? null) : null,
    bgColor: input.bgColor.toLowerCase(),
    textColor: input.textColor.toLowerCase(),
  };
}

export function listPrograms(): Promise<Program[]> {
  return db.select().from(programs).orderBy(programs.status, desc(programs.createdAt));
}

export async function getProgram(id: string): Promise<Program | null> {
  const [row] = await db.select().from(programs).where(eq(programs.id, id));
  return row ?? null;
}

export async function getProgramBySlug(slug: string): Promise<Program | null> {
  const [row] = await db.select().from(programs).where(eq(programs.slug, slug));
  return row ?? null;
}

export async function createProgram(userId: string, input: ProgramInput): Promise<Program> {
  const [row] = await db
    .insert(programs)
    .values({ id: newId(), slug: newCode(10).toLowerCase(), createdBy: userId, ...columns(input) })
    .returning();
  return row!;
}

export async function updateProgram(id: string, input: ProgramInput): Promise<Program> {
  const existing = await getProgram(id);
  if (!existing) throw new AppError("No such program.", 404);
  if (existing.type !== input.type) throw new AppError("A program's type can't change.");
  const [row] = await db
    .update(programs)
    .set({ ...columns(input), updatedAt: nowIso() })
    .where(eq(programs.id, id))
    .returning();
  return row!;
}

export async function setProgramStatus(id: string, status: "active" | "archived") {
  const [row] = await db
    .update(programs)
    .set({ status, updatedAt: nowIso() })
    .where(eq(programs.id, id))
    .returning();
  if (!row) throw new AppError("No such program.", 404);
  return row;
}

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Stores a logo or strip image in R2 and points the program at it. */
export async function setProgramImage(
  bucket: R2Bucket,
  id: string,
  slot: "logo" | "strip",
  file: File | null,
) {
  const program = await getProgram(id);
  if (!program) throw new AppError("No such program.", 404);
  let key: string | null = null;
  if (file) {
    if (!IMAGE_TYPES.includes(file.type)) throw new AppError("Use a PNG, JPEG, WebP or GIF image.");
    if (file.size > MAX_IMAGE_BYTES) throw new AppError("Images can be up to 2 MB.");
    key = newToken32();
    await bucket.put(`programs/${key}`, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });
  }
  const old = slot === "logo" ? program.logoKey : program.stripKey;
  await db
    .update(programs)
    .set(slot === "logo" ? { logoKey: key, updatedAt: nowIso() } : { stripKey: key, updatedAt: nowIso() })
    .where(eq(programs.id, id));
  if (old) await bucket.delete(`programs/${old}`);
}

function newToken32() {
  return newId().replace(/-/g, "");
}

/** An image a program uses, or null for any other key. */
export async function programImage(bucket: R2Bucket, key: string) {
  if (!/^[a-f0-9]{32}$/.test(key)) return null;
  const used = await env.DB
    .prepare("SELECT 1 FROM programs WHERE logo_key = ? OR strip_key = ? LIMIT 1")
    .bind(key, key)
    .first();
  if (!used) return null;
  return bucket.get(`programs/${key}`);
}

export function imageUrl(key: string | null): string | null {
  return key ? `/img/programs/${key}` : null;
}
