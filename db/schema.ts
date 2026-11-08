import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  nickname: text("nickname").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  referrerId: uuid("referrer_id").references((): AnyPgColumn => users.id),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  status: text("status", { enum: ["active", "banned"] }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invites = pgTable(
  "invites",
  {
    code: text("code").primaryKey(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    usedBy: uuid("used_by").references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (t) => [index("invites_created_by_idx").on(t.createdBy)],
);

export const spots = pgTable("spots", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  address: text("address"),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
  lastConfirmedAt: timestamp("last_confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const spotReports = pgTable(
  "spot_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spotId: uuid("spot_id")
      .notNull()
      .references(() => spots.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    guardLevel: integer("guard_level"),
    gateStatus: text("gate_status", { enum: ["no_gate", "gate_installed"] }),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("spot_reports_spot_idx").on(t.spotId, t.createdAt),
    check("guard_level_range", sql`${t.guardLevel} is null or ${t.guardLevel} between 1 and 5`),
    check("note_length", sql`char_length(${t.note}) <= 200`),
  ],
);

export const parkings = pgTable(
  "parkings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    spotId: uuid("spot_id")
      .notNull()
      .references(() => spots.id),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [
    index("parkings_spot_idx").on(t.spotId),
    // 한 선원은 동시에 하나의 정박만 (DB 레벨 보장)
    uniqueIndex("parkings_one_open_per_user")
      .on(t.userId)
      .where(sql`${t.endedAt} is null`),
  ],
);

export type User = typeof users.$inferSelect;
export type Spot = typeof spots.$inferSelect;

/** 두블룬(금화) 장부: 모든 획득·차감 기록. 잔액 = 합계 */
export const doubloonLogs = pgTable(
  "doubloon_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    amount: integer("amount").notNull(),
    reason: text("reason", {
      enum: ["discovery", "new_cell", "report", "parking", "bounty", "fleet", "lineage", "lineage_ban"],
    }).notNull(),
    refId: text("ref_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("doubloon_logs_user_idx").on(t.userId, t.createdAt),
    index("doubloon_logs_created_idx").on(t.createdAt),
  ],
);
