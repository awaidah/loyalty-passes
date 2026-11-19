import { createMiddleware } from "@tanstack/react-start";
import { isAdmin } from "@every-app/sdk/server";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { ensureAppUser } from "@/server/users";
import { AppError } from "@/server/util";

/** A signed-in member, recorded on first sight, with `admin` from their role. */
export const memberMiddleware = createMiddleware({ type: "function" })
  .middleware([ensureUserMiddleware])
  .server(async ({ next, context }) => {
    await ensureAppUser(context.user);
    return next({ context: { admin: isAdmin(context.user) } });
  });

/** Refuses anyone who isn't an owner or admin. */
export const adminMiddleware = createMiddleware({ type: "function" })
  .middleware([memberMiddleware])
  .server(({ next, context }) => {
    if (!context.admin) throw new AppError("Only admins can do that.", 403);
    return next();
  });
