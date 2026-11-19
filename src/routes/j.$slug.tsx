import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { getJoinPage } from "@/serverFunctions/public";

// Public: a customer opens the program's install link without signing in.
export const Route = createFileRoute("/j/$slug")({
  validateSearch: z.object({ error: z.string().max(200).optional().catch(undefined) }),
  loader: ({ params }) => getJoinPage({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.name }] : [] }),
  component: Join,
});

function Join() {
  const program = Route.useLoaderData();
  const { error } = Route.useSearch();
  return (
    <div className="h-dvh overflow-y-auto">
      <main className="mx-auto w-full max-w-md space-y-6 px-4 py-10">
        <div className="space-y-3 rounded-2xl p-6" style={{ backgroundColor: program.bgColor, color: program.textColor }}>
          {program.logoUrl ? <img src={program.logoUrl} alt="" className="size-12 rounded-md object-contain" /> : null}
          <h1 className="text-2xl font-semibold" data-testid="join-program">
            {program.name}
          </h1>
          {program.rewardText ? <p className="text-sm opacity-90">{program.rewardText}</p> : null}
        </div>
        <Card>
          <CardContent>
            {/* A plain form post: it works before any script loads. */}
            <form method="post" action={`/join/${program.slug}`} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" name="name" data-testid="join-name" required maxLength={80} autoComplete="name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email (optional)</Label>
                <Input id="email" name="email" type="email" data-testid="join-email" maxLength={254} autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" name="phone" type="tel" data-testid="join-phone" maxLength={40} autoComplete="tel" />
              </div>
              <p className="text-xs text-muted-foreground">Already joined? Use the same email or phone to get your pass back.</p>
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" className="w-full" data-testid="join-submit">
                Get my pass
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
