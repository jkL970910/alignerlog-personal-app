import { and, asc, count, desc, eq, gte, gt, isNull, lte, lt, or } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { dailyNotes, offTraySessions, plannedTrays, reminderSettings, treatmentPlans, treatmentSeries, users, wearActionLogs, wearStates } from "@/lib/db/schema";
import { dayBounds, todayKey } from "@/lib/dates";
import type { OffTrayReason, PlannedTrayDraft, ReminderSettings, TreatmentPlan, TreatmentPlanImportPreview, WearAction } from "@/lib/types";

import { mapDailyNote, mapOffTraySession, mapPlannedTray, mapReminderSettings, mapTreatmentPlan, mapTreatmentSeries, mapUser, mapWearActionLog, mapWearState } from "./mappers";

const defaultGoalMinutes = 22 * 60;

export async function getUserByEmail(email: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);

  return user ?? null;
}

export async function getUserById(userId: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  return user ?? null;
}

export async function createUser(email: string, passwordHash: string) {
  const db = getDb();
  const now = new Date();
  const [created] = await db.insert(users).values({
    email: email.toLowerCase(),
    passwordHash,
    createdAt: now,
    updatedAt: now
  }).returning();

  return mapUser(created);
}

export async function createUserWithId(userId: string, email: string, passwordHash: string) {
  const db = getDb();
  const now = new Date();
  const [created] = await db.insert(users).values({
    id: userId,
    email: email.toLowerCase(),
    passwordHash,
    createdAt: now,
    updatedAt: now
  }).returning();

  return mapUser(created);
}

export async function countUsers() {
  const db = getDb();
  const [row] = await db.select({ value: count() }).from(users);

  return row?.value ?? 0;
}

export async function getOrCreateTreatmentPlan(userId: string) {
  const db = getDb();
  const [existing] = await db.select().from(treatmentPlans).where(eq(treatmentPlans.userId, userId)).limit(1);

  if (existing) {
    return mapTreatmentPlan(existing);
  }

  const now = new Date();
  const [created] = await db.insert(treatmentPlans).values({
    userId,
    startDate: todayKey(now),
    currentTrayNumber: 1,
    totalTrays: null,
    daysPerTray: 7,
    dailyGoalMinutes: defaultGoalMinutes,
    createdAt: now,
    updatedAt: now
  }).returning();

  return mapTreatmentPlan(created);
}

export async function getWearState(userId: string) {
  const db = getDb();
  const [existing] = await db.select().from(wearStates).where(eq(wearStates.userId, userId)).limit(1);

  return existing ? mapWearState(existing) : null;
}

export async function getOrCreateWearState(userId: string) {
  const db = getDb();
  const [existing] = await db.select().from(wearStates).where(eq(wearStates.userId, userId)).limit(1);

  if (existing) {
    return mapWearState(existing);
  }

  const now = new Date();
  const [created] = await db.insert(wearStates).values({
    userId,
    isWearing: true,
    currentOffSessionId: null,
    lastChangedAt: now,
    updatedAt: now
  }).returning();

  return mapWearState(created);
}

export async function getOrCreateReminderSettings(userId: string) {
  const db = getDb();
  const [existing] = await db.select().from(reminderSettings).where(eq(reminderSettings.userId, userId)).limit(1);

  if (existing) {
    return mapReminderSettings(existing);
  }

  const now = new Date();
  const [created] = await db.insert(reminderSettings).values({
    userId,
    enableMealReminder: false,
    mealReminderMinutes: 45,
    enableBedtimeReminder: false,
    bedtimeReminderTime: "22:30",
    enableTrayChangeReminder: false,
    updatedAt: now
  }).returning();

  return mapReminderSettings(created);
}

export async function getActiveSession(userId: string) {
  const db = getDb();
  const [active] = await db.select().from(offTraySessions)
    .where(and(eq(offTraySessions.userId, userId), isNull(offTraySessions.endAt)))
    .orderBy(desc(offTraySessions.startAt))
    .limit(1);

  return active ? mapOffTraySession(active) : null;
}

export async function listSessionsForRange(userId: string, startDate: string, endDate: string) {
  const db = getDb();
  const start = dayBounds(startDate).start;
  const end = dayBounds(endDate).end;
  const rows = await db.select().from(offTraySessions)
    .where(and(
      eq(offTraySessions.userId, userId),
      lt(offTraySessions.startAt, end),
      or(isNull(offTraySessions.endAt), gt(offTraySessions.endAt, start))
    ))
    .orderBy(asc(offTraySessions.startAt));

  return rows.map(mapOffTraySession);
}

export async function listDailyNotesForRange(userId: string, startDate: string, endDate: string) {
  const db = getDb();
  const rows = await db.select().from(dailyNotes)
    .where(and(
      eq(dailyNotes.userId, userId),
      gte(dailyNotes.date, startDate),
      lte(dailyNotes.date, endDate)
    ))
    .orderBy(asc(dailyNotes.date));

  return rows.map(mapDailyNote);
}

export async function upsertDailyNote(userId: string, date: string, note: string) {
  const db = getDb();
  const now = new Date();
  const [updated] = await db.insert(dailyNotes).values({
    userId,
    date,
    note,
    createdAt: now,
    updatedAt: now
  }).onConflictDoUpdate({
    target: [dailyNotes.userId, dailyNotes.date],
    set: {
      note,
      updatedAt: now
    }
  }).returning();

  return mapDailyNote(updated);
}

export async function startOffTraySession(userId: string, reason?: OffTrayReason) {
  const db = getDb();
  const state = await getWearState(userId);

  if (state && !state.isWearing) {
    const active = await getActiveSession(userId);

    return {
      wearState: state,
      activeSession: active,
      changed: false
    };
  }

  const now = new Date();
  const [session] = await db.insert(offTraySessions).values({
    userId,
    startAt: now,
    endAt: null,
    reason: reason ?? "meal",
    reminderAt: null,
    reminderStatus: "none",
    createdAt: now,
    updatedAt: now
  }).returning();

  const nextState = {
    isWearing: false,
    currentOffSessionId: session.id,
    lastChangedAt: now,
    updatedAt: now
  };
  const [updatedState] = state
    ? await db.update(wearStates)
      .set(nextState)
      .where(eq(wearStates.userId, userId))
      .returning()
    : await db.insert(wearStates).values({
      userId,
      ...nextState
    }).returning();

  return {
    wearState: mapWearState(updatedState),
    activeSession: mapOffTraySession(session),
    changed: true
  };
}

export async function endActiveOffTraySession(userId: string) {
  const db = getDb();
  const state = await getWearState(userId);
  const active = await getActiveSession(userId);

  if (!active) {
    return {
      wearState: state ?? await getOrCreateWearState(userId),
      activeSession: null,
      changed: false
    };
  }

  const now = new Date();
  const [session] = await db.update(offTraySessions)
    .set({
      endAt: now,
      reminderStatus: active.reminderStatus === "scheduled" ? "cancelled" : active.reminderStatus,
      updatedAt: now
    })
    .where(eq(offTraySessions.id, active.id))
    .returning();

  const nextState = {
    isWearing: true,
    currentOffSessionId: null,
    lastChangedAt: now,
    updatedAt: now
  };
  const [updatedState] = state
    ? await db.update(wearStates)
      .set(nextState)
      .where(eq(wearStates.userId, userId))
      .returning()
    : await db.insert(wearStates).values({
      userId,
      ...nextState
    }).returning();

  return {
    wearState: mapWearState(updatedState),
    activeSession: mapOffTraySession(session),
    changed: true
  };
}

export async function createWearActionLog(params: {
  userId: string;
  action: WearAction;
  changed: boolean;
  sessionId?: string | null;
  resultingIsWearing: boolean;
  requestId?: string | null;
  source?: string | null;
  userAgent?: string | null;
  referer?: string | null;
}) {
  const db = getDb();
  const [created] = await db.insert(wearActionLogs).values({
    userId: params.userId,
    action: params.action,
    changed: params.changed,
    sessionId: params.sessionId ?? null,
    resultingIsWearing: params.resultingIsWearing,
    requestId: params.requestId?.slice(0, 128) ?? null,
    source: params.source?.slice(0, 80) ?? null,
    userAgent: params.userAgent ?? null,
    referer: params.referer ?? null,
    createdAt: new Date()
  }).returning();

  return mapWearActionLog(created);
}

export async function updateTreatmentPlan(userId: string, patch: Partial<Pick<
  TreatmentPlan,
  "startDate" | "currentTrayNumber" | "totalTrays" | "daysPerTray" | "dailyGoalMinutes"
>>) {
  await getOrCreateTreatmentPlan(userId);
  const db = getDb();
  const now = new Date();
  const [updated] = await db.update(treatmentPlans)
    .set({
      ...patch,
      updatedAt: now
    })
    .where(eq(treatmentPlans.userId, userId))
    .returning();

  return mapTreatmentPlan(updated);
}

export async function updateReminderSettings(userId: string, patch: Partial<Omit<ReminderSettings, "id" | "userId" | "updatedAt">>) {
  await getOrCreateReminderSettings(userId);
  const db = getDb();
  const now = new Date();
  const [updated] = await db.update(reminderSettings)
    .set({
      ...patch,
      updatedAt: now
    })
    .where(eq(reminderSettings.userId, userId))
    .returning();

  return mapReminderSettings(updated);
}

export async function getActiveTreatmentSeries(userId: string) {
  const db = getDb();
  const [series] = await db.select().from(treatmentSeries)
    .where(and(eq(treatmentSeries.userId, userId), eq(treatmentSeries.isActive, true)))
    .orderBy(desc(treatmentSeries.createdAt))
    .limit(1);

  return series ? mapTreatmentSeries(series) : null;
}

export async function listPlannedTraysForSeries(userId: string, seriesId: string) {
  const db = getDb();
  const rows = await db.select().from(plannedTrays)
    .where(and(eq(plannedTrays.userId, userId), eq(plannedTrays.seriesId, seriesId)))
    .orderBy(asc(plannedTrays.trayNumber));

  return rows.map(mapPlannedTray);
}

export async function saveTreatmentPlanImport(userId: string, preview: TreatmentPlanImportPreview) {
  const db = getDb();
  const now = new Date();

  return db.transaction(async (tx) => {
    await tx.update(treatmentSeries)
      .set({ isActive: false, updatedAt: now })
      .where(and(eq(treatmentSeries.userId, userId), eq(treatmentSeries.isActive, true)));

    const [series] = await tx.insert(treatmentSeries).values({
      userId,
      ...preview.series,
      createdAt: now,
      updatedAt: now
    }).returning();

    const plannedValues = preview.trays.map((tray: PlannedTrayDraft) => ({
      userId,
      seriesId: series.id,
      ...tray,
      createdAt: now,
      updatedAt: now
    }));

    const insertedTrays = plannedValues.length
      ? await tx.insert(plannedTrays).values(plannedValues).returning()
      : [];

    await tx.insert(treatmentPlans).values({
      userId,
      startDate: preview.series.startDate,
      currentTrayNumber: preview.series.currentTrayNumber,
      totalTrays: preview.series.totalTrays,
      daysPerTray: preview.series.trayIntervalDays,
      dailyGoalMinutes: preview.series.dailyGoalMinutes,
      createdAt: now,
      updatedAt: now
    }).onConflictDoUpdate({
      target: treatmentPlans.userId,
      set: {
        startDate: preview.series.startDate,
        currentTrayNumber: preview.series.currentTrayNumber,
        totalTrays: preview.series.totalTrays,
        daysPerTray: preview.series.trayIntervalDays,
        dailyGoalMinutes: preview.series.dailyGoalMinutes,
        updatedAt: now
      }
    });

    return {
      series: mapTreatmentSeries(series),
      trays: insertedTrays.map(mapPlannedTray),
      progress: preview.progress,
      safetyNote: preview.safetyNote
    };
  });
}

export async function updateActiveTreatmentSeries(userId: string, preview: TreatmentPlanImportPreview) {
  const db = getDb();
  const now = new Date();

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(treatmentSeries)
      .where(and(eq(treatmentSeries.userId, userId), eq(treatmentSeries.isActive, true)))
      .orderBy(desc(treatmentSeries.createdAt))
      .limit(1);

    if (!existing) {
      throw new Error("No active treatment plan to update.");
    }

    const [series] = await tx.update(treatmentSeries)
      .set({
        ...preview.series,
        isActive: true,
        updatedAt: now
      })
      .where(and(eq(treatmentSeries.userId, userId), eq(treatmentSeries.id, existing.id)))
      .returning();

    await tx.delete(plannedTrays)
      .where(and(eq(plannedTrays.userId, userId), eq(plannedTrays.seriesId, series.id)));

    const plannedValues = preview.trays.map((tray: PlannedTrayDraft) => ({
      userId,
      seriesId: series.id,
      ...tray,
      createdAt: now,
      updatedAt: now
    }));

    const insertedTrays = plannedValues.length
      ? await tx.insert(plannedTrays).values(plannedValues).returning()
      : [];

    await tx.insert(treatmentPlans).values({
      userId,
      startDate: preview.series.startDate,
      currentTrayNumber: preview.series.currentTrayNumber,
      totalTrays: preview.series.totalTrays,
      daysPerTray: preview.series.trayIntervalDays,
      dailyGoalMinutes: preview.series.dailyGoalMinutes,
      createdAt: now,
      updatedAt: now
    }).onConflictDoUpdate({
      target: treatmentPlans.userId,
      set: {
        startDate: preview.series.startDate,
        currentTrayNumber: preview.series.currentTrayNumber,
        totalTrays: preview.series.totalTrays,
        daysPerTray: preview.series.trayIntervalDays,
        dailyGoalMinutes: preview.series.dailyGoalMinutes,
        updatedAt: now
      }
    });

    return {
      series: mapTreatmentSeries(series),
      trays: insertedTrays.map(mapPlannedTray),
      progress: preview.progress,
      safetyNote: preview.safetyNote
    };
  });
}

export async function listAllSessions(userId: string) {
  const db = getDb();
  const rows = await db.select().from(offTraySessions)
    .where(eq(offTraySessions.userId, userId))
    .orderBy(asc(offTraySessions.startAt));

  return rows.map(mapOffTraySession);
}
