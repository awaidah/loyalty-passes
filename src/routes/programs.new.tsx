import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Page } from "@/client/components/AppNav";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { ProgramForm } from "@/client/features/ProgramForm";
import { getAdmin } from "@/serverFunctions/programs";

export const Route = createFileRoute("/programs/new")({
  loader: () => getAdmin(),
  head: () => ({ meta: [{ title: "New program" }] }),
  component: NewProgram,
});

export function BackToPrograms() {
  return (
    <Link to="/programs" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <ChevronLeft className="size-4" aria-hidden />
      Programs
    </Link>
  );
}

function NewProgram() {
  const { admin } = Route.useLoaderData();
  return (
    <Page>
      <PageHeader title="New program" backLink={<BackToPrograms />} />
      {admin ? (
        <ProgramForm />
      ) : (
        <div data-testid="admin-only">
          <EmptyState title="Only admins create programs" />
        </div>
      )}
    </Page>
  );
}
