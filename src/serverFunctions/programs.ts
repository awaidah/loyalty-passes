import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { z } from "zod";
import * as programs from "@/server/programs";
import { qrSvg } from "@/server/qr";
import { AppError } from "@/server/util";
import { adminMiddleware, memberMiddleware } from "./middleware";

const idInput = z.object({ id: z.string().uuid() });

export const getPrograms = createServerFn()
  .middleware([memberMiddleware])
  .handler(async ({ context }) => {
    const { results } = await env.DB.prepare("SELECT program_id, COUNT(*) AS n FROM passes GROUP BY program_id").all<{ program_id: string; n: number }>();
    const counts = new Map(results.map((r) => [r.program_id, r.n]));
    const list = await programs.listPrograms();
    return {
      admin: context.admin,
      programs: list.map((p) => ({ ...p, passes: counts.get(p.id) ?? 0 })),
    };
  });

export const getProgramPage = createServerFn()
  .middleware([memberMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const program = await programs.getProgram(data.id);
    if (!program) throw new AppError("No such program.", 404);
    const installLink = `${new URL(getRequest().url).origin}/j/${program.slug}`;
    const passes = await env.DB.prepare("SELECT COUNT(*) AS n FROM passes WHERE program_id = ?").bind(program.id).first<{ n: number }>();
    return {
      admin: context.admin,
      program: {
        ...program,
        rewards: programs.parseRewards(program.rewards),
        logoUrl: programs.imageUrl(program.logoKey),
        stripUrl: programs.imageUrl(program.stripKey),
      },
      passCount: passes?.n ?? 0,
      installLink,
      qr: qrSvg(installLink),
    };
  });

export const getAdmin = createServerFn()
  .middleware([memberMiddleware])
  .handler(({ context }) => ({ admin: context.admin }));

export const createProgram = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => programs.programInput.parse(data))
  .handler(async ({ data, context }) => {
    const program = await programs.createProgram(context.user.id, data);
    return { id: program.id };
  });

export const updateProgram = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) =>
    z.object({ id: z.string().uuid(), program: programs.programInput }).parse(data),
  )
  .handler(async ({ data }) => {
    await programs.updateProgram(data.id, data.program);
    return { id: data.id };
  });

export const setProgramStatus = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "archived"]) }).parse(data),
  )
  .handler(async ({ data }) => {
    await programs.setProgramStatus(data.id, data.status);
  });

export const uploadProgramImage = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new AppError("Expected a form.");
    const id = z.string().uuid().parse(data.get("id"));
    const slot = z.enum(["logo", "strip"]).parse(data.get("slot"));
    const file = data.get("file");
    return { id, slot, file: file instanceof File && file.size > 0 ? file : null };
  })
  .handler(async ({ data }) => {
    await programs.setProgramImage(env.files, data.id, data.slot, data.file);
  });
