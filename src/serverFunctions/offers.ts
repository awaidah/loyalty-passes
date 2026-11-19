import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as offers from "@/server/offers";
import { listPrograms } from "@/server/programs";
import { adminMiddleware, memberMiddleware } from "./middleware";

export const getOffers = createServerFn()
  .middleware([memberMiddleware])
  .handler(async ({ context }) => ({
    admin: context.admin,
    offers: await offers.listOffers(),
    programs: (await listPrograms()).filter((p) => p.status === "active").map((p) => ({ id: p.id, name: p.name })),
  }));

export const createOffer = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => offers.offerInput.parse(data))
  .handler(async ({ data, context }) => {
    await offers.createOffer(context.user.id, data);
  });

export const endOffer = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await offers.endOffer(data.id);
  });
