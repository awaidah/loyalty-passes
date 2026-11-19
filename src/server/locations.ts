import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { AppError, newId } from "./util";

export const locationName = z.string().trim().min(1, "Name is required").max(80);

export function listLocations() {
  return db.select().from(locations).orderBy(locations.status, asc(locations.name));
}

export async function createLocation(name: string) {
  const [row] = await db.insert(locations).values({ id: newId(), name }).returning();
  return row!;
}

export async function updateLocation(id: string, change: { name?: string; status?: "active" | "archived" }) {
  const [row] = await db.update(locations).set(change).where(eq(locations.id, id)).returning();
  if (!row) throw new AppError("No such location.", 404);
  return row;
}

export async function activeLocation(id: string | null | undefined) {
  if (!id) return null;
  const [row] = await db.select().from(locations).where(eq(locations.id, id));
  if (!row || row.status !== "active") throw new AppError("Pick an active location.");
  return row;
}
