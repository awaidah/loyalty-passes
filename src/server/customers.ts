import { env } from "cloudflare:workers";
import { z } from "zod";
import { getProgram, listPrograms } from "./programs";
import { viewOf } from "./passes";
import { AppError } from "./util";

export const PAGE_SIZE = 25;
const SORTS = { name: "c.name COLLATE NOCASE", visits: "visits", last: "last_visit", joined: "c.created_at" } as const;

export const listInput = z.object({
  q: z.string().trim().max(100).optional(),
  sort: z.enum(["name", "visits", "last", "joined"]).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).max(10000).optional(),
});

export async function listCustomers(input: z.infer<typeof listInput>) {
  const db = env.DB;
  const where: string[] = [];
  const binds: unknown[] = [];
  if (input.q) {
    where.push("(c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)");
    const like = `%${input.q.replace(/[%_]/g, "")}%`;
    binds.push(like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sort = SORTS[input.sort ?? "last"];
  const dir = (input.dir ?? (input.sort === "name" ? "asc" : "desc")) === "asc" ? "ASC" : "DESC";
  const page = input.page ?? 1;
  const total = await db
    .prepare(`SELECT COUNT(*) AS n FROM customers c ${whereSql}`)
    .bind(...binds)
    .first<{ n: number }>();
  const { results } = await db
    .prepare(
      `SELECT c.id, c.name, c.email, c.phone, c.created_at,
              COALESCE(SUM(p.visit_count), 0) AS visits, MAX(p.last_visit_at) AS last_visit
       FROM customers c LEFT JOIN passes p ON p.customer_id = c.id
       ${whereSql} GROUP BY c.id ORDER BY ${sort} ${dir} NULLS LAST, c.id LIMIT ? OFFSET ?`,
    )
    .bind(...binds, PAGE_SIZE, (page - 1) * PAGE_SIZE)
    .all<{ id: string; name: string; email: string | null; phone: string | null; created_at: string; visits: number; last_visit: string | null }>();
  const ids = results.map((r) => r.id);
  const passes = ids.length
    ? (
        await db
          .prepare(`SELECT * FROM passes WHERE customer_id IN (${ids.map(() => "?").join(",")})`)
          .bind(...ids)
          .all<Parameters<typeof viewOf>[1]>()
      ).results
    : [];
  const programs = new Map((await listPrograms()).map((p) => [p.id, p]));
  return {
    total: total?.n ?? 0,
    page,
    pageSize: PAGE_SIZE,
    customers: results.map((c) => ({
      id: c.id,
      name: c.name,
      contact: c.email ?? c.phone ?? null,
      visits: c.visits,
      lastVisit: c.last_visit,
      passes: passes
        .filter((p) => p.customer_id === c.id)
        .map((p) => {
          const program = programs.get(p.program_id)!;
          return { id: p.id, programName: program.name, balance: viewOf(program, p).balance };
        }),
    })),
  };
}

export async function getCustomer(id: string) {
  const db = env.DB;
  const customer = await db
    .prepare("SELECT id, name, email, phone, created_at FROM customers WHERE id = ?")
    .bind(id)
    .first<{ id: string; name: string; email: string | null; phone: string | null; created_at: string }>();
  if (!customer) throw new AppError("No such customer.", 404);
  const { results: passRows } = await db
    .prepare("SELECT * FROM passes WHERE customer_id = ? ORDER BY created_at")
    .bind(id)
    .all<Parameters<typeof viewOf>[1]>();
  const passes = [];
  for (const p of passRows) {
    const program = (await getProgram(p.program_id))!;
    passes.push({
      id: p.id,
      code: p.code,
      token: p.token,
      programId: program.id,
      programName: program.name,
      status: p.status,
      createdAt: p.created_at,
      view: viewOf(program, p),
    });
  }
  const { results: history } = await db
    .prepare(
      `SELECT v.id, v.kind, v.amount, v.note, v.created_at, v.undone_at, v.staff_email, v.staff_user_id,
              l.name AS location_name, p.name AS program_name, p.type AS program_type
       FROM visits v LEFT JOIN locations l ON l.id = v.location_id JOIN programs p ON p.id = v.program_id
       WHERE v.customer_id = ? ORDER BY v.created_at DESC, v.rowid DESC LIMIT 500`,
    )
    .bind(id)
    .all<{
      id: string; kind: string; amount: number; note: string | null; created_at: string; undone_at: string | null;
      staff_email: string; staff_user_id: string; location_name: string | null; program_name: string; program_type: string;
    }>();
  return {
    customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, createdAt: customer.created_at },
    passes,
    history: history.map((h) => ({
      id: h.id,
      kind: h.kind,
      amount: h.amount,
      note: h.note,
      createdAt: h.created_at,
      undone: h.undone_at !== null,
      staffEmail: h.staff_email,
      staffUserId: h.staff_user_id,
      location: h.location_name,
      programName: h.program_name,
      programType: h.program_type,
    })),
  };
}

export async function revokePass(passId: string) {
  const result = await env.DB.prepare("UPDATE passes SET status = 'revoked' WHERE id = ? AND status = 'active'").bind(passId).run();
  if (!result.meta.changes) throw new AppError("That pass is already cancelled.", 409);
}

function csv(rows: (string | number | null)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          let s = cell === null || cell === undefined ? "" : String(cell);
          // A leading formula character would run in a spreadsheet.
          if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\r\n") + "\r\n";
}

export async function exportCsv(kind: "customers" | "passes" | "visits"): Promise<string> {
  const db = env.DB;
  if (kind === "customers") {
    const { results } = await db
      .prepare(
        `SELECT c.id, c.name, c.email, c.phone, c.created_at, COUNT(p.id) AS passes,
                COALESCE(SUM(p.visit_count), 0) AS visits, MAX(p.last_visit_at) AS last_visit
         FROM customers c LEFT JOIN passes p ON p.customer_id = c.id GROUP BY c.id ORDER BY c.created_at`,
      )
      .all<Record<string, string | number | null>>();
    return csv([
      ["customer_id", "name", "email", "phone", "joined", "passes", "visits", "last_visit"],
      ...results.map((r) => [r.id, r.name, r.email, r.phone, r.created_at, r.passes, r.visits, r.last_visit] as (string | number | null)[]),
    ]);
  }
  if (kind === "passes") {
    const { results } = await db
      .prepare(
        `SELECT p.id, p.code, pr.name AS program, pr.type, c.name AS customer, c.email, p.stamps, p.points, p.visits_used,
                p.rewards_earned, p.rewards_redeemed, p.valid_until, p.status, p.visit_count, p.last_visit_at, p.created_at
         FROM passes p JOIN programs pr ON pr.id = p.program_id JOIN customers c ON c.id = p.customer_id ORDER BY p.created_at`,
      )
      .all<Record<string, string | number | null>>();
    const cols = ["id", "code", "program", "type", "customer", "email", "stamps", "points", "visits_used", "rewards_earned", "rewards_redeemed", "valid_until", "status", "visit_count", "last_visit_at", "created_at"];
    return csv([["pass_id", ...cols.slice(1)], ...results.map((r) => cols.map((c) => r[c] ?? null))]);
  }
  const { results } = await db
    .prepare(
      `SELECT v.id, v.created_at, v.kind, v.amount, v.earned, v.redeemed, v.note, pr.name AS program, p.code,
              c.name AS customer, l.name AS location, v.staff_email, v.undone_at
       FROM visits v JOIN passes p ON p.id = v.pass_id JOIN programs pr ON pr.id = v.program_id
       JOIN customers c ON c.id = v.customer_id LEFT JOIN locations l ON l.id = v.location_id ORDER BY v.created_at`,
    )
    .all<Record<string, string | number | null>>();
  const cols = ["id", "created_at", "kind", "amount", "earned", "redeemed", "note", "program", "code", "customer", "location", "staff_email", "undone_at"];
  return csv([["visit_id", ...cols.slice(1)], ...results.map((r) => cols.map((c) => r[c] ?? null))]);
}
