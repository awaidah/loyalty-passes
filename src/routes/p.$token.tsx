import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Progress } from "@/client/components/ui/progress";
import { getPassPage } from "@/serverFunctions/public";

// Public: the customer's own pass, at a link only they hold.
export const Route = createFileRoute("/p/$token")({
  loader: ({ params }) => getPassPage({ data: { token: params.token } }),
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [{ title: loaderData.program.name }, { name: "robots", content: "noindex" }, { name: "referrer", content: "no-referrer" }]
      : [],
  }),
  component: PassPage,
});

function PassPage() {
  const { pass, program, customerName, view, offers, qr, wallets } = Route.useLoaderData();
  return (
    <div className="h-dvh overflow-y-auto">
      <main className="mx-auto w-full max-w-md space-y-6 px-4 py-8">
        <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: program.bgColor, color: program.textColor }}>
          {program.stripUrl ? <img src={program.stripUrl} alt="" className="h-28 w-full object-cover" /> : null}
          <div className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              {program.logoUrl ? <img src={program.logoUrl} alt="" className="size-10 rounded-md object-contain" /> : null}
              <h1 className="text-xl font-semibold" data-testid="pass-program">
                {program.name}
              </h1>
            </div>
            <div>
              <div className="text-sm opacity-80" data-testid="pass-customer">
                {customerName}
              </div>
              <div className="text-3xl font-semibold tabular-nums" data-testid="pass-balance">
                {view.balance}
              </div>
            </div>
            {view.progress && view.state === "ok" ? (
              <Progress data-testid="pass-progress" value={(view.progress.value / view.progress.max) * 100} aria-label="Progress" />
            ) : null}
            {program.rewardText ? <p className="text-sm opacity-90">{program.rewardText}</p> : null}
          </div>
        </div>

        {view.stateLabel ? (
          <div className="text-center">
            <Badge variant="destructive" data-testid="pass-state">
              {view.stateLabel}
            </Badge>
          </div>
        ) : null}

        {view.rewardsReady > 0 && program.type !== "coupon" ? (
          <Card size="sm" data-testid="pass-rewards">
            <CardContent className="space-y-1 text-sm">
              <div className="font-medium">
                {view.rewardsReady} {view.rewardsReady === 1 ? "reward" : "rewards"} ready to redeem
              </div>
              {program.type === "points" ? (
                <ul className="text-muted-foreground">
                  {program.rewards.map((r) => (
                    <li key={r.id}>
                      {r.name}: {r.cost} points
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {view.state !== "revoked" ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3">
              <div className="size-56" data-testid="pass-qr" dangerouslySetInnerHTML={{ __html: qr }} />
              <div className="font-mono text-xl tracking-widest" data-testid="pass-code">
                {pass.code}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {wallets.apple || wallets.google ? (
          <div className="flex flex-col gap-2">
            {wallets.apple ? (
              <Button variant="outline" nativeButton={false} data-testid="wallet-apple" render={<a href={`/wallet/apple/${pass.token}`} />}>
                Add to Apple Wallet
              </Button>
            ) : null}
            {wallets.google ? (
              <Button variant="outline" nativeButton={false} data-testid="wallet-google" render={<a href={`/wallet/google/${pass.token}`} />}>
                Add to Google Wallet
              </Button>
            ) : null}
          </div>
        ) : null}

        {offers.length ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Offers</h2>
            {offers.map((o) => (
              <Card key={o.id} size="sm" data-testid="pass-offer">
                <CardHeader>
                  <CardTitle>{o.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">{o.body}</CardContent>
              </Card>
            ))}
          </section>
        ) : null}
        <p className="text-center text-xs text-muted-foreground">Bookmark this page to keep your pass.</p>
      </main>
    </div>
  );
}
