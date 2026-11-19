import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

/** Members the Gateway signed in, keyed by the Gateway's user id. */
export const appUsers = sqliteTable("app_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  firstSeen: text("first_seen").notNull().default(now),
});

export const programs = sqliteTable(
  "programs",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    type: text("type", {
      enum: ["stamp", "points", "multivisit", "membership", "coupon"],
    }).notNull(),
    name: text("name").notNull(),
    rewardText: text("reward_text").notNull().default(""),
    stampGoal: integer("stamp_goal"),
    pointsPerVisit: integer("points_per_visit"),
    pointsPerAmount: integer("points_per_amount"),
    // JSON list of { id, name, cost } for points programs.
    rewards: text("rewards").notNull().default("[]"),
    visitLimit: integer("visit_limit"),
    validDays: integer("valid_days"),
    expiresAt: text("expires_at"),
    bgColor: text("bg_color").notNull(),
    textColor: text("text_color").notNull(),
    logoKey: text("logo_key"),
    stripKey: text("strip_key"),
    status: text("status", { enum: ["active", "archived"] })
      .notNull()
      .default("active"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [uniqueIndex("programs_slug").on(t.slug)],
);

export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status", { enum: ["active", "archived"] })
    .notNull()
    .default("active"),
  createdAt: text("created_at").notNull().default(now),
});

export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    index("customers_email").on(t.email),
    index("customers_phone").on(t.phone),
  ],
);

export const passes = sqliteTable(
  "passes",
  {
    id: text("id").primaryKey(),
    programId: text("program_id").notNull(),
    customerId: text("customer_id").notNull(),
    token: text("token").notNull(),
    code: text("code").notNull(),
    stamps: integer("stamps").notNull().default(0),
    points: integer("points").notNull().default(0),
    visitsUsed: integer("visits_used").notNull().default(0),
    rewardsEarned: integer("rewards_earned").notNull().default(0),
    rewardsRedeemed: integer("rewards_redeemed").notNull().default(0),
    validUntil: text("valid_until"),
    status: text("status", { enum: ["active", "revoked"] })
      .notNull()
      .default("active"),
    visitCount: integer("visit_count").notNull().default(0),
    lastVisitAt: text("last_visit_at"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("passes_token").on(t.token),
    uniqueIndex("passes_code").on(t.code),
    uniqueIndex("passes_program_customer").on(t.programId, t.customerId),
    index("passes_customer").on(t.customerId),
  ],
);

export const visits = sqliteTable(
  "visits",
  {
    id: text("id").primaryKey(),
    passId: text("pass_id").notNull(),
    programId: text("program_id").notNull(),
    customerId: text("customer_id").notNull(),
    locationId: text("location_id"),
    staffUserId: text("staff_user_id").notNull(),
    staffEmail: text("staff_email").notNull(),
    kind: text("kind", {
      enum: ["stamp", "points", "checkin", "redeem"],
    }).notNull(),
    // Stamps or points added; on a redeem, the stamps or points taken off.
    amount: integer("amount").notNull().default(0),
    earned: integer("earned").notNull().default(0),
    redeemed: integer("redeemed").notNull().default(0),
    note: text("note"),
    undoneAt: text("undone_at"),
    undoneBy: text("undone_by"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    index("visits_pass").on(t.passId, t.createdAt),
    index("visits_created").on(t.createdAt),
  ],
);

export const offers = sqliteTable("offers", {
  id: text("id").primaryKey(),
  // Null: every program.
  programId: text("program_id"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(now),
});
