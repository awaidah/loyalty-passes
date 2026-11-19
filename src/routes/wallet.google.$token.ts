import { createFileRoute } from "@tanstack/react-router";
import { publicPass } from "@/server/passes";
import { googleSaveUrl, googleWalletReady } from "@/server/wallet";

export const Route = createFileRoute("/wallet/google/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!googleWalletReady()) return new Response("Not found", { status: 404 });
        const pass = await publicPass(params.token);
        if (!pass) return new Response("Not found", { status: 404 });
        const url = await googleSaveUrl(pass, new URL(request.url).origin);
        return new Response(null, { status: 302, headers: { location: url, "cache-control": "no-store" } });
      },
    },
  },
});
