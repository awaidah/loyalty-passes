import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Page } from "@/client/components/AppNav";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { CopyButton } from "@/client/components/CopyButton";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { errorMessage } from "@/client/lib/errors";
import { formatDay, TYPE_LABEL } from "@/client/lib/format";
import { getProgramPage, setProgramStatus } from "@/serverFunctions/programs";
import { BackToPrograms } from "./programs.new";

export const Route = createFileRoute("/programs/$programId/")({
  loader: ({ params }) => getProgramPage({ data: { id: params.programId } }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.program.name }] : [] }),
  component: ProgramPage,
});

function summary(p: ReturnType<typeof Route.useLoaderData>["program"]): string {
  switch (p.type) {
    case "stamp":
      return `${p.stampGoal} stamps earn the reward`;
    case "points": {
      const earn = [
        p.pointsPerVisit ? `${p.pointsPerVisit} points per visit` : null,
        p.pointsPerAmount ? `${p.pointsPerAmount} points per 1 spent` : null,
      ].filter(Boolean);
      return earn.join(", ");
    }
    case "multivisit":
      return `${p.visitLimit} uses`;
    case "membership":
      return `Valid for ${p.validDays} days from joining`;
    case "coupon":
      return p.expiresAt ? `One use, until ${formatDay(`${p.expiresAt}T12:00:00Z`)}` : "One use";
  }
  return "";
}

function ProgramPage() {
  const { admin, program, installLink, qr, passCount } = Route.useLoaderData();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const archived = program.status === "archived";

  async function changeStatus(status: "active" | "archived") {
    setPending(true);
    try {
      await setProgramStatus({ data: { id: program.id, status } });
      await router.invalidate();
      setConfirm(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Page>
      <PageHeader
        title={program.name}
        backLink={<BackToPrograms />}
        description={
          <span className="inline-flex items-center gap-2">
            {TYPE_LABEL[program.type]}
            <Badge data-testid="program-status" variant={archived ? "secondary" : "success"}>
              {archived ? "Archived" : "Active"}
            </Badge>
          </span>
        }
        actions={
          admin ? (
            <>
              <Button variant="outline" nativeButton={false} data-testid="program-edit" render={<Link to="/programs/$programId/edit" params={{ programId: program.id }} />}>
                Edit
              </Button>
              {archived ? (
                <Button variant="outline" pending={pending} onClick={() => changeStatus("active")}>
                  Restore
                </Button>
              ) : (
                <Button variant="outline" data-testid="program-archive" onClick={() => setConfirm(true)}>
                  Archive
                </Button>
              )}
            </>
          ) : null
        }
      />
      <Card>
        <CardContent className="grid gap-6 sm:grid-cols-[1fr_auto]">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">{program.type === "membership" ? "Benefit" : "Reward"}</dt>
              <dd data-testid="program-reward-text">{program.rewardText}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Rules</dt>
              <dd data-testid="program-summary">{summary(program)}</dd>
            </div>
            {program.type === "points" ? (
              <div>
                <dt className="text-muted-foreground">Rewards</dt>
                <dd>
                  <ul>
                    {program.rewards.map((r) => (
                      <li key={r.id}>
                        {r.name}: {r.cost} points
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground">Passes</dt>
              <dd>{passCount}</dd>
            </div>
          </dl>
          <div
            className="w-full overflow-hidden rounded-xl sm:w-64"
            style={{ backgroundColor: program.bgColor, color: program.textColor }}
          >
            {program.stripUrl ? <img src={program.stripUrl} alt="" className="h-20 w-full object-cover" /> : null}
            <div className="flex items-center gap-3 p-4">
              {program.logoUrl ? <img src={program.logoUrl} alt="" className="size-10 rounded-md object-contain" /> : null}
              <div className="font-semibold">{program.name}</div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Install link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {archived ? (
            <p className="text-sm text-muted-foreground">Archived programs take no new customers.</p>
          ) : null}
          <div className="flex items-center gap-2">
            <code data-testid="install-link" className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-sm">
              {installLink}
            </code>
            <CopyButton value={installLink} successMessage="Link copied" />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div data-testid="install-qr" className="size-48" dangerouslySetInnerHTML={{ __html: qr }} />
            <Button variant="outline" onClick={() => printQr(program.name, qr)}>
              Print QR code
            </Button>
          </div>
        </CardContent>
      </Card>
      {confirm ? (
        <ConfirmDialog
          title={`Archive ${program.name}?`}
          confirmLabel="Archive"
          confirmTestId="confirm-archive"
          pending={pending}
          onClose={() => setConfirm(false)}
          onConfirm={() => changeStatus("archived")}
        >
          New customers can't join. Existing passes keep working.
        </ConfirmDialog>
      ) : null}
    </Page>
  );
}

function printQr(name: string, svg: string) {
  const win = window.open("", "_blank", "width=480,height=600");
  if (!win) return;
  const doc = win.document;
  doc.title = name;
  const heading = doc.createElement("h1");
  heading.textContent = name;
  heading.style.fontFamily = "system-ui, sans-serif";
  heading.style.textAlign = "center";
  const box = doc.createElement("div");
  box.style.width = "320px";
  box.style.margin = "0 auto";
  box.innerHTML = svg;
  doc.body.appendChild(heading);
  doc.body.appendChild(box);
  win.focus();
  win.print();
}
