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
  // 상점에서 산 꾸미기
  flag: text("flag").notNull().default("☠"),
  nameColor: text("name_color"),
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
  /** 전설의 정박지 별명 (영주가 붙임) */
  nickname: text("nickname"),
  /** 선원이 금화로 건 현상금 (확인한 사람이 받아감) */
  postedBounty: integer("posted_bounty").notNull().default(0),
  /** 정박지 소개: 누구나 고칠 수 있는 설명 (입구, 층, 주의사항 등) */
  description: text("description"),
  descriptionBy: uuid("description_by").references((): AnyPgColumn => users.id),
  descriptionAt: timestamp("description_at", { withTimezone: true }),
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
      enum: [
        "discovery",
        "new_cell",
        "report",
        "parking",
        "bounty",
        "fleet",
        "lineage",
        "lineage_ban",
        "toll",
        "treasure",
        "stash_hide",
        "stash_found",
        "bounty_post",
        "shop",
        "duel_stake",
        "duel_win",
        "duel_refund",
        "anniversary",
        "wonder_solved",
      ],
    }).notNull(),
    refId: text("ref_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("doubloon_logs_user_idx").on(t.userId, t.createdAt),
    index("doubloon_logs_created_idx").on(t.createdAt),
  ],
);

/** 선원이 정박지에 묻어 둔 보물. 다음에 정박한 다른 선원이 가져간다 */
export const stashes = pgTable(
  "stashes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spotId: uuid("spot_id")
      .notNull()
      .references(() => spots.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    amount: integer("amount").notNull(),
    foundBy: uuid("found_by").references(() => users.id),
    foundAt: timestamp("found_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stashes_spot_idx").on(t.spotId)],
);

/** 오늘의 보물상자 (한국 날짜당 1개) */
export const dailyTreasures = pgTable("daily_treasures", {
  day: text("day").primaryKey(), // YYYY-MM-DD (KST)
  spotId: uuid("spot_id")
    .notNull()
    .references(() => spots.id),
  amount: integer("amount").notNull(),
  claimedBy: uuid("claimed_by").references(() => users.id),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
});

/** 결투: 7일 동안 정박 횟수 대결, 이긴 쪽이 판돈 2배 */
export const duels = pgTable(
  "duels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengerId: uuid("challenger_id")
      .notNull()
      .references(() => users.id),
    opponentId: uuid("opponent_id")
      .notNull()
      .references(() => users.id),
    stake: integer("stake").notNull(),
    status: text("status", { enum: ["pending", "active", "declined", "expired", "done"] })
      .notNull()
      .default("pending"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    winnerId: uuid("winner_id").references(() => users.id),
    challengerScore: integer("challenger_score"),
    opponentScore: integer("opponent_score"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("duels_challenger_idx").on(t.challengerId), index("duels_opponent_idx").on(t.opponentId)],
);

/** 무전기: 지도 위 한 줄 쪽지 (1시간 뒤 사라짐) */
export const radioMessages = pgTable(
  "radio_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("radio_created_idx").on(t.createdAt)],
);

/** 궁금한 곳: 선원이 지도에 찍어 둔 ❓ (확인해 줄 사람을 기다림). 근처에 정박지가 등록되면 해결 */
export const wonders = pgTable(
  "wonders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    note: text("note").notNull().default(""),
    resolvedSpotId: uuid("resolved_spot_id").references(() => spots.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("wonders_open_idx").on(t.resolvedAt)],
);
