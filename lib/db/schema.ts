import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const offTrayReasonEnum = pgEnum("off_tray_reason", [
  "meal",
  "drink",
  "brushing",
  "other"
]);

export const reminderStatusEnum = pgEnum("reminder_status", [
  "none",
  "scheduled",
  "sent",
  "cancelled"
]);

export const treatmentPlans = pgTable(
  "treatment_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    startDate: varchar("start_date", { length: 10 }).notNull(),
    currentTrayNumber: integer("current_tray_number").notNull().default(1),
    totalTrays: integer("total_trays"),
    daysPerTray: integer("days_per_tray").notNull().default(7),
    dailyGoalMinutes: integer("daily_goal_minutes").notNull().default(1320),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdIdx: uniqueIndex("treatment_plans_user_id_idx").on(table.userId)
  })
);

export const wearStates = pgTable(
  "wear_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    isWearing: boolean("is_wearing").notNull().default(true),
    currentOffSessionId: uuid("current_off_session_id"),
    lastChangedAt: timestamp("last_changed_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdIdx: uniqueIndex("wear_states_user_id_idx").on(table.userId)
  })
);

export const offTraySessions = pgTable(
  "off_tray_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    reason: offTrayReasonEnum("reason"),
    reminderAt: timestamp("reminder_at", { withTimezone: true }),
    reminderStatus: reminderStatusEnum("reminder_status").notNull().default("none"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userStartIdx: index("off_tray_sessions_user_start_idx").on(table.userId, table.startAt),
    activeSessionIdx: uniqueIndex("off_tray_sessions_active_user_idx")
      .on(table.userId)
      .where(sql`${table.endAt} IS NULL`)
  })
);

export const dailyNotes = pgTable(
  "daily_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    date: varchar("date", { length: 10 }).notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userDateIdx: uniqueIndex("daily_notes_user_date_idx").on(table.userId, table.date)
  })
);

export const reminderSettings = pgTable(
  "reminder_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    enableMealReminder: boolean("enable_meal_reminder").notNull().default(false),
    mealReminderMinutes: integer("meal_reminder_minutes").notNull().default(45),
    enableBedtimeReminder: boolean("enable_bedtime_reminder").notNull().default(false),
    bedtimeReminderTime: varchar("bedtime_reminder_time", { length: 5 }).notNull().default("22:30"),
    enableTrayChangeReminder: boolean("enable_tray_change_reminder").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdIdx: uniqueIndex("reminder_settings_user_id_idx").on(table.userId)
  })
);
