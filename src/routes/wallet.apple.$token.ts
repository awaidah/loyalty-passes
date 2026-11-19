import { createFileRoute } from "@tanstack/react-router";
import { applePkpass, appleWalletReady } from "@/server/wallet";

export const Route = createFileRoute("/wallet/apple/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!appleWalletReady()) return new Response("Not found", { status: 404 });
        const file = await applePkpass(params.token, new URL(request.url).origin);
        if (!file) return new Response("Not found", { status: 404 });
        return new Response(file.slice().buffer as ArrayBuffer, {
          headers: {
            "content-type": "application/vnd.apple.pkpass",
            "content-disposition": 'attachment; filename="pass.pkpass"',
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
