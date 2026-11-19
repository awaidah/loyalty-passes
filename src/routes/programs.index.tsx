import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/client/components/AppNav";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { TYPE_LABEL } from "@/client/lib/format";
import { getPrograms } from "@/serverFunctions/programs";

export const Route = createFileRoute("/programs/")({
  loader: () => getPrograms(),
  head: () => ({ meta: [{ title: "Programs" }] }),
  component: Programs,
});

function Programs() {
  const { admin, programs } = Route.useLoaderData();
  const create = admin ? (
    <Button nativeButton={false} render={<Link to="/programs/new" />} data-testid="program-new">
      New program
    </Button>
  ) : null;
  return (
    <Page>
      <PageHeader title="Programs" actions={create} />
      {programs.length === 0 ? (
        <EmptyState title="No programs yet" description={admin ? "Create one and share its link with customers." : "An admin creates programs."} />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {programs.map((p) => (
            <li key={p.id} data-testid="program-row" className="flex items-center gap-3 p-4">
              <span className="size-8 shrink-0 rounded-lg border border-border" style={{ backgroundColor: p.bgColor }} aria-hidden />
              <div className="min-w-0 flex-1">
                <Link to="/programs/$programId" params={{ programId: p.id }} className="font-medium hover:underline">
                  {p.name}
                </Link>
                <div className="text-sm text-muted-foreground">
                  {TYPE_LABEL[p.type]} · {p.passes} {p.passes === 1 ? "pass" : "passes"}
                </div>
              </div>
              {p.status === "archived" ? <Badge variant="secondary">Archived</Badge> : null}
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
