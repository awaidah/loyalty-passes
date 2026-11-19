import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { getEveryAppUser, isAdmin } from "@every-app/sdk/server";
import { undoVisit } from "@/server/passes";
import { ensureAppUser } from "@/server/users";
import { AppError } from "@/server/util";

// Reverses one recorded visit: the scanner's and the customer page's Undo.
export const Route = createFileRoute("/api/visits/$visitId/undo")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const user = await getEveryAppUser(request, env);
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
        await ensureAppUser(user);
        try {
          return Response.json(await undoVisit(user, isAdmin(user), params.visitId));
        } catch (error) {
          if (error instanceof AppError) return Response.json({ error: error.message }, { status: error.status });
          throw error;
        }
      },
    },
  },
});
