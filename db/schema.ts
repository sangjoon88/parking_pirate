import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  jsonb,
  primaryKey,
  customType,
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
  /** 닉네임 효과 (반짝이 등). 닉네임 색이 있어야 살 수 있다 */
  nameEffect: text("name_effect"),
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
    /** 쓴 선원이 고친 시각 (안 고쳤으면 null) */
    updatedAt: timestamp("updated_at", { withTimezone: true }),
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
        "naval_shop",
        "naval_loot",
        "naval_defense",
        "tribute",
        "tribute_paid",
        "independence",
        "spot_deleted",
        "stash_refund",
        "bounty_refund",
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

/** 사진 원본 바이트 (Postgres bytea) */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

/**
 * 사진: 정박지 소개 사진(reportId 없음) 또는 항해 일지 사진(reportId 있음).
 * 브라우저에서 줄이고 위치 정보(EXIF)를 지운 JPEG만 받는다.
 */
export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spotId: uuid("spot_id")
      .notNull()
      .references(() => spots.id),
    reportId: uuid("report_id").references(() => spotReports.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    mime: text("mime").notNull(),
    data: bytea("data").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("photos_spot_idx").on(t.spotId, t.createdAt), index("photos_report_idx").on(t.reportId)],
);

/** 경비원 메모: 정박지마다 여러 개. 번호는 뒷자리 4자리만 */
export const guardContacts = pgTable(
  "guard_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spotId: uuid("spot_id")
      .notNull()
      .references(() => spots.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    label: text("label").notNull().default(""),
    digits: text("digits").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("guard_contacts_spot_idx").on(t.spotId),
    check("guard_digits_4", sql`${t.digits} ~ '^[0-9]{4}$'`),
    check("guard_label_length", sql`char_length(${t.label}) <= 30`),
  ],
);

/** 해적단: 선원 한 명당 하나 (계보와 상관없이 독립) */
export const crews = pgTable("crews", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  name: text("name").notNull().unique(),
  shipTier: integer("ship_tier").notNull().default(0),
  /** 체력: hp_at 시점의 값. 지금 체력은 회복 속도로 계산 */
  hp: integer("hp").notNull(),
  hpAt: timestamp("hp_at", { withTimezone: true }).notNull().defaultNow(),
  /** 휘하: 이 해적단을 거느린 해적단과 기한 */
  overlordId: uuid("overlord_id").references((): AnyPgColumn => crews.userId),
  vassalUntil: timestamp("vassal_until", { withTimezone: true }),
  vassalBattleId: uuid("vassal_battle_id"),
  tributeRate: integer("tribute_rate").notNull().default(0),
  /** 이 시각까지 다른 해적단이 공격할 수 없음 (창단·독립 직후) */
  protectedUntil: timestamp("protected_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 해적단 무기·방어구 창고 (소모품, 개수) */
export const crewItems = pgTable(
  "crew_items",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => crews.userId),
    itemId: text("item_id").notNull(),
    qty: integer("qty").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] }), check("crew_items_qty", sql`${t.qty} >= 0`)],
);

/** 해적단 NPC 선원 (요리사, 의사 …) 과 레벨 */
export const crewNpcs = pgTable(
  "crew_npcs",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => crews.userId),
    role: text("role").notNull(),
    level: integer("level").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);

/** 해전 기록 */
export const battles = pgTable(
  "battles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attackerId: uuid("attacker_id")
      .notNull()
      .references(() => crews.userId),
    defenderId: uuid("defender_id")
      .notNull()
      .references(() => crews.userId),
    winnerId: uuid("winner_id").notNull(),
    independence: boolean("independence").notNull().default(false),
    /** 전투 재생용 기록 (양쪽 상태, 턴별 포격, 부서진 장비, 결과) */
    log: jsonb("log").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("battles_attacker_idx").on(t.attackerId, t.createdAt),
    index("battles_defender_idx").on(t.defenderId, t.createdAt),
    index("battles_created_idx").on(t.createdAt),
  ],
);
