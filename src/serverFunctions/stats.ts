import { createServerFn } from "@tanstack/react-start";
import { getStats } from "@/server/stats";
import { statsInput } from "@/server/stats";
import { listLocations } from "@/server/locations";
import { listPrograms } from "@/server/programs";
import { memberMiddleware } from "./middleware";

export const getDashboard = createServerFn()
  .middleware([memberMiddleware])
  .validator((data: unknown) => statsInput.parse(data))
  .handler(async ({ data }) => ({
    stats: await getStats(data),
    programs: (await listPrograms()).map((p) => ({ id: p.id, name: p.name })),
    locations: (await listLocations()).map((l) => ({ id: l.id, name: l.name })),
  }));
