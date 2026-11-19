import { createFileRoute } from "@tanstack/react-router";
import { joinInput, joinProgram } from "@/server/passes";
import { AppError } from "@/server/util";

// The join form posts here; the customer lands on their own pass.
export const Route = createFileRoute("/join/$slug")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const form = await request.formData();
        const parsed = joinInput.safeParse({
          name: form.get("name") ?? "",
          email: form.get("email") ?? "",
          phone: form.get("phone") ?? "",
        });
        if (!parsed.success) {
          const message = parsed.error.issues[0]?.message ?? "Check the form";
          return redirect(`/j/${encodeURIComponent(params.slug)}?error=${encodeURIComponent(message)}`);
        }
        try {
          const token = await joinProgram(params.slug, parsed.data);
          return redirect(`/p/${token}`);
        } catch (error) {
          if (error instanceof AppError && error.status === 404) return new Response("Not found", { status: 404 });
          throw error;
        }
      },
    },
  },
});

function redirect(location: string) {
  return new Response(null, { status: 303, headers: { location } });
}
