import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as locations from "@/server/locations";
import { adminMiddleware, memberMiddleware } from "./middleware";

export const getLocations = createServerFn()
  .middleware([memberMiddleware])
  .handler(async ({ context }) => ({ admin: context.admin, locations: await locations.listLocations() }));

export const createLocation = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) => z.object({ name: locations.locationName }).parse(data))
  .handler(async ({ data }) => {
    await locations.createLocation(data.name);
  });

export const updateLocation = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: locations.locationName.optional(),
        status: z.enum(["active", "archived"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data: { id, ...change } }) => {
    await locations.updateLocation(id, change);
  });
