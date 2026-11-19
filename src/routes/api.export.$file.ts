import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { getEveryAppUser, isAdmin } from "@every-app/sdk/server";
import { exportCsv } from "@/server/customers";

const FILES = { "customers.csv": "customers", "passes.csv": "passes", "visits.csv": "visits" } as const;

// CSV downloads for admins.
export const Route = createFileRoute("/api/export/$file")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getEveryAppUser(request, env);
        if (!user) return new Response("Unauthorized", { status: 401 });
        if (!isAdmin(user)) return new Response("Only admins can export.", { status: 403 });
        const kind = FILES[params.file as keyof typeof FILES];
        if (!kind) return new Response("Not found", { status: 404 });
        const day = new Date().toISOString().slice(0, 10);
        return new Response(await exportCsv(kind), {
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": `attachment; filename="${kind}-${day}.csv"`,
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
