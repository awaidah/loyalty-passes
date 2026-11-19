import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as passes from "@/server/passes";
import { listLocations } from "@/server/locations";
import { memberMiddleware } from "./middleware";

export const getScanSetup = createServerFn()
  .middleware([memberMiddleware])
  .handler(async () => ({
    locations: (await listLocations()).filter((l) => l.status === "active").map((l) => ({ id: l.id, name: l.name })),
  }));

export const lookupPass = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => z.object({ code: z.string().trim().min(1, "Enter a code").max(200) }).parse(data))
  .handler(({ data }) => passes.lookupCode(data.code));

export const recordAction = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => passes.actionInput.parse(data))
  .handler(({ data, context }) => passes.recordAction(context.user, data));
