import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { programImage } from "@/server/programs";

// Program logos and strip images, which pass pages and wallet passes show.
export const Route = createFileRoute("/img/programs/$key")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const object = await programImage(env.files, params.key);
        if (!object) return new Response("Not found", { status: 404 });
        return new Response(object.body, {
          headers: {
            "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
            "cache-control": "public, max-age=86400",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
