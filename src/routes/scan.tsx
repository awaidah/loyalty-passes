import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, CameraOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Page } from "@/client/components/AppNav";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Progress } from "@/client/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { CameraScanner } from "@/client/features/CameraScanner";
import { errorMessage } from "@/client/lib/errors";
import { getScanSetup, lookupPass, recordAction } from "@/serverFunctions/scan";

export const Route = createFileRoute("/scan")({
  ssr: false,
  loader: () => getScanSetup(),
  head: () => ({ meta: [{ title: "Scan" }] }),
  component: Scan,
});

type Result = Awaited<ReturnType<typeof lookupPass>>;
const LOCATION_KEY = "scan-location";

function Scan() {
  const { locations } = Route.useLoaderData();
  const [locationId, setLocationId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [camera, setCamera] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastVisit, setLastVisit] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [stampCount, setStampCount] = useState("1");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(LOCATION_KEY);
    const pick = locations.find((l) => l.id === saved) ?? (locations.length === 1 ? locations[0] : undefined);
    if (pick) setLocationId(pick.id);
  }, [locations]);

  function chooseLocation(id: string | null) {
    setLocationId(id);
    if (id) localStorage.setItem(LOCATION_KEY, id);
  }

  async function lookup(value: string) {
    setError(null);
    setMessage(null);
    setLastVisit(null);
    setPending("lookup");
    try {
      setResult(await lookupPass({ data: { code: value } }));
    } catch (e) {
      setResult(null);
      setError(errorMessage(e));
    } finally {
      setPending(null);
    }
  }

  async function act(
    key: string,
    action: "stamp" | "points_visit" | "points_amount" | "checkin" | "redeem",
    extra: { count?: number; amount?: number; rewardId?: string },
    done: string,
  ) {
    if (!result) return;
    setError(null);
    setMessage(null);
    setPending(key);
    try {
      const next = await recordAction({ data: { passId: result.passId, locationId, action, ...extra } });
      const { visitId, ...view } = next;
      setResult(view);
      setLastVisit(visitId);
      setMessage(done);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(null);
    }
  }

  async function undo() {
    if (!lastVisit) return;
    setError(null);
    setPending("undo");
    try {
      const res = await fetch(`/api/visits/${lastVisit}/undo`, { method: "POST" });
      const body = (await res.json()) as Result & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "That didn't work.");
      setResult(body);
      setLastVisit(null);
      setMessage("Undone");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(null);
    }
  }

  const items = locations.map((l) => ({ value: l.id, label: l.name }));
  const ok = result?.view.state === "ok";
  const p = result?.program;

  return (
    <Page>
      <PageHeader title="Scan" />
      <div className="space-y-1.5">
        <Label>Location</Label>
        {locations.length ? (
          <Select items={items} value={locationId} onValueChange={(v) => chooseLocation(v as string | null)}>
            <SelectTrigger data-testid="scan-location" className="w-full sm:w-72">
              <SelectValue placeholder="Choose a location" />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-sm text-muted-foreground">
            No locations yet. <Link to="/locations" className="underline">Add one</Link> to record where visits happen.
          </p>
        )}
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(code);
        }}
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="code">Pass code</Label>
          <Input id="code" data-testid="scan-code" autoComplete="off" autoCapitalize="characters" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <Button type="submit" data-testid="scan-lookup" pending={pending === "lookup"}>
          Find
        </Button>
        <Button type="button" variant="outline" data-testid="scan-camera" onClick={() => setCamera((c) => !c)}>
          {camera ? <CameraOff /> : <Camera />}
          {camera ? "Stop camera" : "Camera"}
        </Button>
      </form>
      {camera ? (
        <CameraScanner
          onCode={(value) => {
            setCode(value);
            void lookup(value);
          }}
        />
      ) : null}

      {error ? (
        <Alert variant="destructive" data-testid="scan-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {result && p ? (
        <Card data-testid="scan-result">
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link to="/customers/$customerId" params={{ customerId: result.customer.id }} className="text-lg font-semibold hover:underline" data-testid="scan-customer">
                  {result.customer.name}
                </Link>
                <div className="text-sm text-muted-foreground">
                  {p.name} · {result.code}
                </div>
              </div>
              {result.view.stateLabel ? (
                <Badge variant="destructive" data-testid="scan-state">
                  {result.view.stateLabel}
                </Badge>
              ) : null}
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-semibold tabular-nums" data-testid="scan-balance">
                {result.view.balance}
              </div>
              {result.view.progress ? <Progress value={(result.view.progress.value / result.view.progress.max) * 100} /> : null}
              {result.view.rewardsReady > 0 && p.type !== "coupon" ? (
                <div className="text-sm font-medium text-success" data-testid="scan-rewards">
                  {result.view.rewardsReady} {result.view.rewardsReady === 1 ? "reward" : "rewards"} ready
                </div>
              ) : null}
            </div>

            {ok && p.type === "stamp" ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="stamps">Stamps</Label>
                  <Input id="stamps" className="w-20" type="number" min={1} max={100} data-testid="stamp-count" value={stampCount} onChange={(e) => setStampCount(e.target.value)} />
                </div>
                <Button data-testid="action-stamp" pending={pending === "stamp"} onClick={() => act("stamp", "stamp", { count: Number(stampCount) || 1 }, `Added ${Number(stampCount) || 1} ${Number(stampCount) === 1 ? "stamp" : "stamps"}`)}>
                  Add stamps
                </Button>
                <Button variant="outline" data-testid="action-redeem" pending={pending === "redeem"} onClick={() => act("redeem", "redeem", {}, "Reward redeemed")}>
                  Redeem reward
                </Button>
              </div>
            ) : null}

            {ok && p.type === "points" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-2">
                  {p.pointsPerVisit ? (
                    <Button data-testid="action-points-visit" pending={pending === "pv"} onClick={() => act("pv", "points_visit", {}, `Added ${p.pointsPerVisit} points`)}>
                      Add {p.pointsPerVisit} points for this visit
                    </Button>
                  ) : null}
                </div>
                {p.pointsPerAmount ? (
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act("pa", "points_amount", { amount: Number(amount) }, "Points added");
                    }}
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="amount">Amount spent</Label>
                      <Input id="amount" className="w-32" type="number" min={0.01} step={0.01} required data-testid="points-amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    </div>
                    <Button type="submit" variant="outline" data-testid="action-points-amount" pending={pending === "pa"}>
                      Add points
                    </Button>
                  </form>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {p.rewards.map((r, i) => (
                    <Button key={r.id} variant="outline" data-testid={`redeem-reward-${i}`} pending={pending === `r${i}`} onClick={() => act(`r${i}`, "redeem", { rewardId: r.id }, `${r.name} redeemed`)}>
                      Redeem {r.name} ({r.cost})
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {ok && (p.type === "multivisit" || p.type === "membership") ? (
              <Button data-testid="action-checkin" pending={pending === "checkin"} onClick={() => act("checkin", "checkin", {}, "Checked in")}>
                Check in
              </Button>
            ) : null}

            {ok && p.type === "coupon" ? (
              <Button data-testid="action-redeem" pending={pending === "redeem"} onClick={() => act("redeem", "redeem", {}, "Coupon redeemed")}>
                Redeem coupon
              </Button>
            ) : null}

            {message ? (
              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4 text-sm">
                <span data-testid="scan-message" className="font-medium">
                  {message}
                </span>
                {lastVisit ? (
                  <Button size="sm" variant="ghost" data-testid="action-undo" pending={pending === "undo"} onClick={undo}>
                    Undo
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </Page>
  );
}
