import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/client/components/AppNav";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { ProgramForm } from "@/client/features/ProgramForm";
import { getProgramPage } from "@/serverFunctions/programs";
import { BackToPrograms } from "./programs.new";

export const Route = createFileRoute("/programs/$programId/edit")({
  loader: ({ params }) => getProgramPage({ data: { id: params.programId } }),
  head: () => ({ meta: [{ title: "Edit program" }] }),
  component: EditProgram,
});

function EditProgram() {
  const { admin, program } = Route.useLoaderData();
  return (
    <Page>
      <PageHeader title={`Edit ${program.name}`} backLink={<BackToPrograms />} />
      {admin ? (
        <ProgramForm
          programId={program.id}
          initial={{
            type: program.type,
            name: program.name,
            rewardText: program.rewardText,
            stampGoal: program.stampGoal,
            pointsPerVisit: program.pointsPerVisit,
            pointsPerAmount: program.pointsPerAmount,
            rewards: program.rewards.length ? program.rewards : [{ name: "", cost: 100 }],
            visitLimit: program.visitLimit,
            validDays: program.validDays,
            expiresAt: program.expiresAt,
            bgColor: program.bgColor,
            textColor: program.textColor,
          }}
        />
      ) : (
        <div data-testid="admin-only">
          <EmptyState title="Only admins edit programs" />
        </div>
      )}
    </Page>
  );
}
