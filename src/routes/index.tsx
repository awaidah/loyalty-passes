import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Area, AreaChart } from "recharts";
import { z } from "zod";
import { Page } from "@/client/components/AppNav";
import { ChartGrid, ChartXAxis, ChartYAxis } from "@/client/components/ChartAxes";
import { PageHeader } from "@/client/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/client/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/client/components/ui/toggle-group";
import { getDashboard } from "@/serverFunctions/stats";

const search = z.object({
  range: z.coerce.number().optional().catch(undefined),
  program: z.string().optional().catch(undefined),
  location: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/")({
  validateSearch: search,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    getDashboard({ data: { range: deps.range ?? 30, programId: deps.program, locationId: deps.location } }),
  head: () => ({ meta: [{ title: "Dashboard" }] }),
  component: Dashboard,
});

const chartConfig = {
  visits: { label: "Visits", color: "var(--chart-1)" },
  passes: { label: "New passes", color: "var(--chart-2)" },
} satisfies ChartConfig;

const ALL = "all";

function Dashboard() {
  const { stats, programs, locations } = Route.useLoaderData();
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const t = stats.totals;
  const tiles = [
    { id: "stat-passes", label: "New passes", value: String(t.passes) },
    { id: "stat-visits", label: "Visits", value: String(t.visits) },
    { id: "stat-earned", label: "Rewards earned", value: String(t.earned) },
    { id: "stat-redeemed", label: "Rewards redeemed", value: String(t.redeemed) },
    { id: "stat-repeat", label: "Repeat customers", value: t.repeatShare === null ? "—" : `${t.repeatShare}%` },
  ];
  const programItems = [{ value: ALL, label: "All programs" }, ...programs.map((p) => ({ value: p.id, label: p.name }))];
  const locationItems = [{ value: ALL, label: "All locations" }, ...locations.map((l) => ({ value: l.id, label: l.name }))];

  return (
    <Page>
      <PageHeader title="Dashboard" />
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          value={[String(stats.range)]}
          onValueChange={(v: unknown[]) => {
            const next = Number(v[0]);
            if (next) void navigate({ search: { ...s, range: next } });
          }}
          variant="outline"
          size="sm"
        >
          {[7, 30, 90].map((r) => (
            <ToggleGroupItem key={r} value={String(r)} data-testid={`range-${r}`}>
              {r} days
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Select items={programItems} value={s.program ?? ALL} onValueChange={(v) => navigate({ search: { ...s, program: v === ALL ? undefined : (v as string) } })}>
          <SelectTrigger size="sm" data-testid="filter-program" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {programItems.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={locationItems} value={s.location ?? ALL} onValueChange={(v) => navigate({ search: { ...s, location: v === ALL ? undefined : (v as string) } })}>
          <SelectTrigger size="sm" data-testid="filter-location" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {locationItems.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((tile) => (
          <Card key={tile.id} size="sm">
            <CardContent className="space-y-1">
              <div className="text-xs text-muted-foreground">{tile.label}</div>
              <div className="text-2xl font-semibold tabular-nums" data-testid={tile.id}>
                {tile.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Visits and new passes</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
            <AreaChart data={stats.series} margin={{ left: 0, right: 8 }}>
              <ChartGrid />
              <ChartXAxis dataKey="day" tickFormatter={(d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
              <ChartYAxis allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area dataKey="visits" type="monotone" stroke="var(--color-visits)" fill="var(--color-visits)" fillOpacity={0.15} />
              <Area dataKey="passes" type="monotone" stroke="var(--color-passes)" fill="var(--color-passes)" fillOpacity={0.15} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </Page>
  );
}
