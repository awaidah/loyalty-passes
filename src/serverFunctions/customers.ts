import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as customers from "@/server/customers";
import { adminMiddleware, memberMiddleware } from "./middleware";

export const getCustomers = createServerFn()
  .middleware([memberMiddleware])
  .validator((data: unknown) => customers.listInput.parse(data))
  .handler(async ({ data, context }) => ({ admin: context.admin, ...(await customers.listCustomers(data)) }));

export const getCustomer = createServerFn()
  .middleware([memberMiddleware])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => ({
    admin: context.admin,
    userId: context.user.id,
    ...(await customers.getCustomer(data.id)),
  }));

export const revokePass = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => z.object({ passId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await customers.revokePass(data.passId);
  });
