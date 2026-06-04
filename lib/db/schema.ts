import { boolean, index, integer, pgTable, pgEnum, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
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

export const treatmentStatusEnum = pgEnum("treatment_status", [
  "not_started",
  "active",
  "holding",
  "waiting_refinement",
  "retainer"
]);

export const treatmentSeriesTypeEnum = pgEnum("treatment_series_type", [
  "active",
  "refinement",
  "holding",
  "retainer"
]);

export const plannedTrayStatusEnum = pgEnum("planned_tray_status", [
  "completed",
  "current",
  "upcoming",
  "extended",
  "paused",
  "skipped_by_clinician"
]);

export const plannedTraySourceEnum = pgEnum("planned_tray_source", [
  "imported",
  "generated",
  "adjusted"
]);

export const wearActionEnum = pgEnum("wear_action", [
  "start",
  "end"
]);

export const pushSubscriptionStatusEnum = pgEnum("push_subscription_status", [
  "active",
  "disabled",
  "expired"
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email)
  })
);

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

export const wearActionLogs = pgTable(
  "wear_action_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    action: wearActionEnum("action").notNull(),
    changed: boolean("changed").notNull(),
    sessionId: uuid("session_id"),
    resultingIsWearing: boolean("resulting_is_wearing").notNull(),
    requestId: varchar("request_id", { length: 128 }),
    source: varchar("source", { length: 80 }),
    userAgent: text("user_agent"),
    referer: text("referer"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userCreatedIdx: index("wear_action_logs_user_created_idx").on(table.userId, table.createdAt),
    sessionIdx: index("wear_action_logs_session_idx").on(table.sessionId)
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

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    status: pushSubscriptionStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
  },
  (table) => ({
    endpointIdx: uniqueIndex("push_subscriptions_endpoint_idx").on(table.endpoint),
    userStatusIdx: index("push_subscriptions_user_status_idx").on(table.userId, table.status)
  })
);

export const reminderJobs = pgTable(
  "reminder_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    sessionId: uuid("session_id").notNull(),
    kind: varchar("kind", { length: 40 }).notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("scheduled"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    sessionKindIdx: uniqueIndex("reminder_jobs_session_kind_idx").on(table.sessionId, table.kind),
    dueStatusIdx: index("reminder_jobs_due_status_idx").on(table.status, table.dueAt),
    userStatusIdx: index("reminder_jobs_user_status_idx").on(table.userId, table.status)
  })
);

export const treatmentSeries = pgTable(
  "treatment_series",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    name: varchar("name", { length: 80 }).notNull().default("第一阶段"),
    status: treatmentStatusEnum("status").notNull().default("active"),
    seriesType: treatmentSeriesTypeEnum("series_type").notNull().default("active"),
    startDate: varchar("start_date", { length: 10 }).notNull(),
    currentTrayNumber: integer("current_tray_number").notNull(),
    totalTrays: integer("total_trays"),
    overallTotalTrays: integer("overall_total_trays"),
    overallTreatmentDays: integer("overall_treatment_days"),
    trayIntervalDays: integer("tray_interval_days").notNull().default(7),
    dailyGoalMinutes: integer("daily_goal_minutes").notNull().default(1320),
    currentTrayStartDate: varchar("current_tray_start_date", { length: 10 }).notNull(),
    nextChangeDate: varchar("next_change_date", { length: 10 }),
    appointmentDate: varchar("appointment_date", { length: 10 }),
    clinicianNotes: text("clinician_notes").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userActiveIdx: index("treatment_series_user_active_idx").on(table.userId, table.isActive),
    userCreatedIdx: index("treatment_series_user_created_idx").on(table.userId, table.createdAt)
  })
);

export const plannedTrays = pgTable(
  "planned_trays",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    seriesId: uuid("series_id").notNull(),
    trayNumber: integer("tray_number").notNull(),
    plannedStartDate: varchar("planned_start_date", { length: 10 }).notNull(),
    plannedEndDate: varchar("planned_end_date", { length: 10 }).notNull(),
    status: plannedTrayStatusEnum("status").notNull().default("upcoming"),
    source: plannedTraySourceEnum("source").notNull().default("generated"),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userSeriesTrayIdx: uniqueIndex("planned_trays_user_series_tray_idx").on(table.userId, table.seriesId, table.trayNumber),
    userDateIdx: index("planned_trays_user_date_idx").on(table.userId, table.plannedStartDate, table.plannedEndDate)
  })
);
