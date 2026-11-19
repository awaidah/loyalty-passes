import { useRouter } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { errorMessage } from "@/client/lib/errors";
import { TYPE_LABEL } from "@/client/lib/format";
import { createProgram, updateProgram, uploadProgramImage } from "@/serverFunctions/programs";

type ProgramType = keyof typeof TYPE_LABEL;

export interface ProgramValues {
  type: ProgramType;
  name: string;
  rewardText: string;
  stampGoal: number | null;
  pointsPerVisit: number | null;
  pointsPerAmount: number | null;
  rewards: { id?: string; name: string; cost: number | string }[];
  visitLimit: number | null;
  validDays: number | null;
  expiresAt: string | null;
  bgColor: string;
  textColor: string;
}

const DEFAULTS: ProgramValues = {
  type: "stamp",
  name: "",
  rewardText: "",
  stampGoal: 10,
  pointsPerVisit: 10,
  pointsPerAmount: 0,
  rewards: [{ name: "", cost: 100 }],
  visitLimit: 10,
  validDays: 30,
  expiresAt: null,
  bgColor: "#24324a",
  textColor: "#ffffff",
};

function Row({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

const num = (v: string) => (v === "" ? null : Number(v));

export function ProgramForm({ programId, initial }: { programId?: string; initial?: ProgramValues }) {
  const router = useRouter();
  const [values, setValues] = useState<ProgramValues>(initial ?? DEFAULTS);
  const [logo, setLogo] = useState<File | null>(null);
  const [strip, setStrip] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = <K extends keyof ProgramValues>(key: K, value: ProgramValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const t = values.type;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const program = {
        ...values,
        rewards: t === "points" ? values.rewards.map((r) => ({ ...r, cost: Number(r.cost) })) : [],
        expiresAt: values.expiresAt || null,
      };
      const { id } = programId
        ? await updateProgram({ data: { id: programId, program } })
        : await createProgram({ data: program });
      for (const [slot, file] of [["logo", logo], ["strip", strip]] as const) {
        if (!file) continue;
        const form = new FormData();
        form.set("id", id);
        form.set("slot", slot);
        form.set("file", file);
        await uploadProgramImage({ data: form });
      }
      await router.navigate({ to: "/programs/$programId", params: { programId: id } });
    } catch (cause) {
      setError(errorMessage(cause));
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Card>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TYPE_LABEL) as ProgramType[]).map((type) => (
                <Button
                  key={type}
                  type="button"
                  size="sm"
                  data-testid={`type-${type}`}
                  variant={t === type ? "default" : "outline"}
                  aria-pressed={t === type}
                  disabled={Boolean(programId) && t !== type}
                  onClick={() => set("type", type)}
                >
                  {TYPE_LABEL[type]}
                </Button>
              ))}
            </div>
          </div>
          <Row label="Name" htmlFor="name">
            <Input id="name" data-testid="program-name" required maxLength={80} value={values.name} onChange={(e) => set("name", e.target.value)} />
          </Row>
          <Row label={t === "membership" ? "Benefit" : "Reward"} htmlFor="reward">
            <Textarea id="reward" data-testid="program-reward" maxLength={300} rows={2} value={values.rewardText} onChange={(e) => set("rewardText", e.target.value)} />
          </Row>
          {t === "stamp" ? (
            <Row label="Stamps for a reward" htmlFor="goal">
              <Input id="goal" data-testid="program-stamp-goal" type="number" min={1} max={100} required value={values.stampGoal ?? ""} onChange={(e) => set("stampGoal", num(e.target.value))} />
            </Row>
          ) : null}
          {t === "points" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Row label="Points per visit" htmlFor="ppv">
                  <Input id="ppv" data-testid="program-points-per-visit" type="number" min={0} value={values.pointsPerVisit ?? ""} onChange={(e) => set("pointsPerVisit", num(e.target.value))} />
                </Row>
                <Row label="Points per 1 spent" htmlFor="ppa">
                  <Input id="ppa" data-testid="program-points-per-amount" type="number" min={0} value={values.pointsPerAmount ?? ""} onChange={(e) => set("pointsPerAmount", num(e.target.value))} />
                </Row>
              </div>
              <div className="space-y-2">
                <Label>Rewards</Label>
                {values.rewards.map((reward, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input aria-label="Reward name" placeholder="Reward" data-testid={`reward-name-${i}`} value={reward.name} required onChange={(e) => set("rewards", values.rewards.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))} />
                    <Input aria-label="Cost in points" className="w-28" type="number" min={1} data-testid={`reward-cost-${i}`} value={reward.cost} required onChange={(e) => set("rewards", values.rewards.map((r, j) => (j === i ? { ...r, cost: e.target.value } : r)))} />
                    <span className="text-sm text-muted-foreground">points</span>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove reward" disabled={values.rewards.length === 1} onClick={() => set("rewards", values.rewards.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => set("rewards", [...values.rewards, { name: "", cost: 100 }])}>
                  <Plus /> Add reward
                </Button>
              </div>
            </>
          ) : null}
          {t === "multivisit" ? (
            <Row label="Uses" htmlFor="uses">
              <Input id="uses" data-testid="program-visit-limit" type="number" min={1} required value={values.visitLimit ?? ""} onChange={(e) => set("visitLimit", num(e.target.value))} />
            </Row>
          ) : null}
          {t === "membership" ? (
            <Row label="Days valid from joining" htmlFor="days">
              <Input id="days" data-testid="program-valid-days" type="number" min={1} required value={values.validDays ?? ""} onChange={(e) => set("validDays", num(e.target.value))} />
            </Row>
          ) : null}
          {t === "coupon" ? (
            <Row label="Expires (optional)" htmlFor="expires">
              <Input id="expires" data-testid="program-expires" type="date" value={values.expiresAt ?? ""} onChange={(e) => set("expiresAt", e.target.value || null)} />
            </Row>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Row label="Background colour" htmlFor="bg">
              <Input id="bg" data-testid="program-bg" type="color" className="h-10 w-20 p-1" value={values.bgColor} onChange={(e) => set("bgColor", e.target.value)} />
            </Row>
            <Row label="Text colour" htmlFor="fg">
              <Input id="fg" data-testid="program-fg" type="color" className="h-10 w-20 p-1" value={values.textColor} onChange={(e) => set("textColor", e.target.value)} />
            </Row>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Row label="Logo (optional)" htmlFor="logo">
              <Input id="logo" data-testid="program-logo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
            </Row>
            <Row label="Strip image (optional)" htmlFor="strip">
              <Input id="strip" data-testid="program-strip" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setStrip(e.target.files?.[0] ?? null)} />
            </Row>
          </div>
          <p className="text-xs text-muted-foreground">PNG, JPEG, WebP or GIF, up to 2 MB.</p>
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: values.bgColor, color: values.textColor }}
            aria-label="Preview"
          >
            <div className="text-lg font-semibold">{values.name || "Program name"}</div>
            <div className="text-sm opacity-80">{values.rewardText}</div>
          </div>
        </CardContent>
      </Card>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.history.back()}>
          Cancel
        </Button>
        <Button type="submit" data-testid="program-save" pending={pending}>
          {programId ? "Save changes" : "Create program"}
        </Button>
      </div>
    </form>
  );
}
