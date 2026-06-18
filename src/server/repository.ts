import { and, asc, count, desc, eq, gte, gt, isNull, lte, lt, ne, or } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { dailyNotes, dentalPhotoRecords, looDentalAiUsageLogs, looDentalMinisterChatMessages, looDentalMinisterChatSessions, offTraySessions, plannedTrays, pushSubscriptions, reminderJobs, reminderSettings, treatmentExceptionEvents, treatmentPlans, treatmentSeries, users, wearActionLogs, wearStates } from "@/lib/db/schema";
import { addDaysToDateKey, dayBounds, todayKey } from "@/lib/dates";
import type { DentalPhotoViewType, OffTrayReason, PlannedTrayDraft, ReminderSettings, TreatmentExceptionStatus, TreatmentExceptionType, TreatmentPlan, TreatmentPlanImportPreview, WearAction } from "@/lib/types";

import { mapDailyNote, mapDentalPhotoRecord, mapLooDentalAiUsageLog, mapLooDentalMinisterChatMessage, mapLooDentalMinisterChatSession, mapOffTraySession, mapPlannedTray, mapPushSubscription, mapReminderJob, mapReminderSettings, mapTreatmentExceptionEvent, mapTreatmentPlan, mapTreatmentSeries, mapUser, mapWearActionLog, mapWearState } from "./mappers";
import { scheduleReminderDelivery } from "./reminder-scheduler";

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

export async function getTrackingStartedAt(userId: string) {
  const db = getDb();
  const [firstAction] = await db.select({ createdAt: wearActionLogs.createdAt })
    .from(wearActionLogs)
    .where(eq(wearActionLogs.userId, userId))
    .orderBy(asc(wearActionLogs.createdAt))
    .limit(1);

  if (firstAction) {
    return firstAction.createdAt;
  }

  const [firstSession] = await db.select({ startAt: offTraySessions.startAt })
    .from(offTraySessions)
    .where(eq(offTraySessions.userId, userId))
    .orderBy(asc(offTraySessions.startAt))
    .limit(1);

  if (firstSession) {
    return firstSession.startAt;
  }

  const [state] = await db.select({ lastChangedAt: wearStates.lastChangedAt })
    .from(wearStates)
    .where(eq(wearStates.userId, userId))
    .limit(1);

  return state?.lastChangedAt ?? null;
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
    mealReminderMinutes: 30,
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

export async function listSessionsForRange(userId: string, startDate: string, endDate: string, timeZone = "UTC") {
  const db = getDb();
  const start = dayBounds(startDate, timeZone).start;
  const end = dayBounds(endDate, timeZone).end;
  const rows = await db.select().from(offTraySessions)
    .where(and(
      eq(offTraySessions.userId, userId),
      lt(offTraySessions.startAt, end),
      or(isNull(offTraySessions.endAt), gt(offTraySessions.endAt, start))
    ))
    .orderBy(asc(offTraySessions.startAt));

  return rows.map(mapOffTraySession);
}

export async function listSessionsForDate(userId: string, date: string, timeZone = "UTC") {
  return listSessionsForRange(userId, date, date, timeZone);
}

export async function listDailyNotesForRange(userId: string, startDate: string, endDate: string) {
  const db = getDb();
  const rows = await db.select().from(dailyNotes)
    .where(and(
      eq(dailyNotes.userId, userId),
      gte(dailyNotes.date, startDate),
      lte(dailyNotes.date, endDate)
    ))
    .orderBy(asc(dailyNotes.date), asc(dailyNotes.createdAt));

  return rows.map(mapDailyNote);
}

export async function createDailyNote(userId: string, date: string, note: string) {
  const db = getDb();
  const now = new Date();
  const [created] = await db.insert(dailyNotes).values({
    userId,
    date,
    note,
    createdAt: now,
    updatedAt: now
  }).returning();

  return mapDailyNote(created);
}

export async function updateDailyNote(userId: string, noteId: string, note: string) {
  const db = getDb();
  const [updated] = await db.update(dailyNotes)
    .set({
      note,
      updatedAt: new Date()
    })
    .where(and(eq(dailyNotes.userId, userId), eq(dailyNotes.id, noteId)))
    .returning();

  if (!updated) {
    throw new Error("找不到这条札记。");
  }

  return mapDailyNote(updated);
}

export async function deleteDailyNote(userId: string, noteId: string) {
  const db = getDb();
  const [deleted] = await db.delete(dailyNotes)
    .where(and(eq(dailyNotes.userId, userId), eq(dailyNotes.id, noteId)))
    .returning();

  if (!deleted) {
    throw new Error("找不到这条札记。");
  }

  return mapDailyNote(deleted);
}

export async function listDentalPhotoRecords(userId: string) {
  const db = getDb();
  const rows = await db.select().from(dentalPhotoRecords)
    .where(eq(dentalPhotoRecords.userId, userId))
    .orderBy(desc(dentalPhotoRecords.date), desc(dentalPhotoRecords.createdAt));

  return rows.map(mapDentalPhotoRecord);
}

export async function listDentalPhotoCountsForRange(userId: string, startDate: string, endDate: string) {
  const db = getDb();
  const rows = await db.select({
    date: dentalPhotoRecords.date,
    value: count()
  }).from(dentalPhotoRecords)
    .where(and(
      eq(dentalPhotoRecords.userId, userId),
      gte(dentalPhotoRecords.date, startDate),
      lte(dentalPhotoRecords.date, endDate)
    ))
    .groupBy(dentalPhotoRecords.date);

  return new Map(rows.map((row) => [row.date, row.value]));
}

export async function createDentalPhotoRecord(params: {
  userId: string;
  date: string;
  stageName?: string;
  trayNumber?: number | null;
  viewType: DentalPhotoViewType;
  note?: string;
  imageDataUrl: string;
  imageMimeType: string;
  imageSizeBytes: number;
}) {
  const db = getDb();
  const now = new Date();
  const [created] = await db.insert(dentalPhotoRecords).values({
    userId: params.userId,
    date: params.date,
    stageName: params.stageName?.trim().slice(0, 80) ?? "",
    trayNumber: params.trayNumber ?? null,
    viewType: params.viewType,
    note: params.note?.trim().slice(0, 1000) ?? "",
    imageDataUrl: params.imageDataUrl,
    imageMimeType: params.imageMimeType,
    imageSizeBytes: params.imageSizeBytes,
    createdAt: now,
    updatedAt: now
  }).returning();

  return mapDentalPhotoRecord(created);
}

export async function updateDentalPhotoRecord(params: {
  userId: string;
  photoId: string;
  date: string;
  stageName?: string;
  trayNumber?: number | null;
  viewType: DentalPhotoViewType;
  note?: string;
}) {
  const db = getDb();
  const [updated] = await db.update(dentalPhotoRecords)
    .set({
      date: params.date,
      stageName: params.stageName?.trim().slice(0, 80) ?? "",
      trayNumber: params.trayNumber ?? null,
      viewType: params.viewType,
      note: params.note?.trim().slice(0, 1000) ?? "",
      updatedAt: new Date()
    })
    .where(and(eq(dentalPhotoRecords.userId, params.userId), eq(dentalPhotoRecords.id, params.photoId)))
    .returning();

  if (!updated) {
    throw new Error("找不到这张照片记录。");
  }

  return mapDentalPhotoRecord(updated);
}

export async function deleteDentalPhotoRecord(userId: string, photoId: string) {
  const db = getDb();
  const [deleted] = await db.delete(dentalPhotoRecords)
    .where(and(eq(dentalPhotoRecords.userId, userId), eq(dentalPhotoRecords.id, photoId)))
    .returning();

  if (!deleted) {
    throw new Error("找不到这张照片记录。");
  }

  return mapDentalPhotoRecord(deleted);
}

export async function createLooDentalAiUsageLog(params: {
  userId: string;
  questionLength: number;
  status: "ok" | "failed";
  failureKind?: string | null;
  errorMessage?: string | null;
  latencyMs?: number | null;
  model?: string;
}) {
  const db = getDb();
  const [created] = await db.insert(looDentalAiUsageLogs).values({
    userId: params.userId,
    questionLength: params.questionLength,
    status: params.status,
    failureKind: params.failureKind?.slice(0, 80) ?? null,
    errorMessage: params.errorMessage?.slice(0, 1000) ?? null,
    latencyMs: params.latencyMs ?? null,
    model: params.model ?? "gpt-5.5",
    createdAt: new Date()
  }).returning();

  return mapLooDentalAiUsageLog(created);
}

export async function createLooDentalMinisterChatSession(userId: string, title = "新对话") {
  const db = getDb();
  const now = new Date();
  const [created] = await db.insert(looDentalMinisterChatSessions).values({
    userId,
    title: title.trim().slice(0, 120) || "新对话",
    createdAt: now,
    updatedAt: now
  }).returning();

  return mapLooDentalMinisterChatSession(created);
}

export async function listLooDentalMinisterChatSessions(userId: string, limit = 12) {
  const db = getDb();
  const rows = await db.select().from(looDentalMinisterChatSessions)
    .where(eq(looDentalMinisterChatSessions.userId, userId))
    .orderBy(desc(looDentalMinisterChatSessions.updatedAt))
    .limit(limit);

  return rows.map(mapLooDentalMinisterChatSession);
}

export async function getLooDentalMinisterChatSession(userId: string, sessionId: string) {
  const db = getDb();
  const [session] = await db.select().from(looDentalMinisterChatSessions)
    .where(and(eq(looDentalMinisterChatSessions.userId, userId), eq(looDentalMinisterChatSessions.id, sessionId)))
    .limit(1);

  return session ? mapLooDentalMinisterChatSession(session) : null;
}

export async function listLooDentalMinisterChatMessages(userId: string, sessionId: string, limit = 80) {
  const db = getDb();
  const rows = await db.select().from(looDentalMinisterChatMessages)
    .where(and(eq(looDentalMinisterChatMessages.userId, userId), eq(looDentalMinisterChatMessages.sessionId, sessionId)))
    .orderBy(asc(looDentalMinisterChatMessages.createdAt))
    .limit(limit);

  return rows.map(mapLooDentalMinisterChatMessage);
}

export async function appendLooDentalMinisterChatTurn(params: {
  userId: string;
  sessionId?: string | null;
  question: string;
  answer: string;
}) {
  const db = getDb();
  const now = new Date();
  const session = params.sessionId
    ? await getLooDentalMinisterChatSession(params.userId, params.sessionId)
    : null;
  const activeSession = session ?? await createLooDentalMinisterChatSession(params.userId, titleFromQuestion(params.question));
  const values = [
    {
      userId: params.userId,
      sessionId: activeSession.id,
      role: "user",
      content: params.question.trim().slice(0, 1200),
      createdAt: now
    },
    {
      userId: params.userId,
      sessionId: activeSession.id,
      role: "minister",
      content: params.answer.trim().slice(0, 3000),
      createdAt: new Date(now.getTime() + 1)
    }
  ];
  const inserted = await db.insert(looDentalMinisterChatMessages).values(values).returning();
  const titlePatch = activeSession.title === "新对话" ? titleFromQuestion(params.question) : activeSession.title;
  const [updatedSession] = await db.update(looDentalMinisterChatSessions)
    .set({
      title: titlePatch,
      updatedAt: new Date()
    })
    .where(and(eq(looDentalMinisterChatSessions.userId, params.userId), eq(looDentalMinisterChatSessions.id, activeSession.id)))
    .returning();

  return {
    session: mapLooDentalMinisterChatSession(updatedSession),
    messages: inserted.map(mapLooDentalMinisterChatMessage)
  };
}

function titleFromQuestion(question: string) {
  return question.trim().replace(/\s+/g, " ").slice(0, 36) || "新对话";
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
  await scheduleMealReminderJob(userId, session.id, now);

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
  await cancelReminderJobsForSession(userId, active.id);

  return {
    wearState: mapWearState(updatedState),
    activeSession: mapOffTraySession(session),
    changed: true
  };
}

export async function endActiveOffTraySessionAt(params: {
  userId: string;
  endAt: Date;
}) {
  const now = new Date();

  if (params.endAt.getTime() > now.getTime()) {
    throw new Error("补记时间不能晚于当前时间。");
  }

  const db = getDb();
  const state = await getWearState(params.userId);
  const active = await getActiveSession(params.userId);

  if (!active) {
    throw new Error("当前没有正在取下的记录，无法补记戴回时间。");
  }

  if (params.endAt.getTime() <= new Date(active.startAt).getTime()) {
    throw new Error("戴回时间必须晚于取下时间。");
  }

  const [session] = await db.update(offTraySessions)
    .set({
      endAt: params.endAt,
      reminderStatus: active.reminderStatus === "scheduled" ? "cancelled" : active.reminderStatus,
      updatedAt: now
    })
    .where(eq(offTraySessions.id, active.id))
    .returning();
  const nextState = {
    isWearing: true,
    currentOffSessionId: null,
    lastChangedAt: params.endAt,
    updatedAt: now
  };
  const [updatedState] = state
    ? await db.update(wearStates)
      .set(nextState)
      .where(eq(wearStates.userId, params.userId))
      .returning()
    : await db.insert(wearStates).values({
      userId: params.userId,
      ...nextState
    }).returning();
  await cancelReminderJobsForSession(params.userId, active.id);

  return {
    session: mapOffTraySession(session),
    wearState: mapWearState(updatedState)
  };
}

export async function createManualOffTraySession(params: {
  userId: string;
  startAt: Date;
  endAt: Date;
  reason?: OffTrayReason;
}) {
  if (params.endAt.getTime() <= params.startAt.getTime()) {
    throw new Error("戴回时间必须晚于取下时间。");
  }

  const now = new Date();

  if (params.startAt.getTime() > now.getTime() || params.endAt.getTime() > now.getTime()) {
    throw new Error("补记时间不能晚于当前时间。");
  }

  const db = getDb();
  const overlapping = await db.select().from(offTraySessions)
    .where(and(
      eq(offTraySessions.userId, params.userId),
      lt(offTraySessions.startAt, params.endAt),
      or(isNull(offTraySessions.endAt), gt(offTraySessions.endAt, params.startAt))
    ))
    .limit(1);

  if (overlapping.length > 0) {
    throw new Error("补记时间与已有取下记录重叠，请调整时间。");
  }

  const [session] = await db.insert(offTraySessions).values({
    userId: params.userId,
    startAt: params.startAt,
    endAt: params.endAt,
    reason: params.reason ?? "other",
    reminderAt: null,
    reminderStatus: "none",
    createdAt: now,
    updatedAt: now
  }).returning();

  return mapOffTraySession(session);
}

export async function updateManualOffTraySession(params: {
  userId: string;
  sessionId: string;
  startAt: Date;
  endAt: Date;
  reason?: OffTrayReason;
}) {
  if (params.endAt.getTime() <= params.startAt.getTime()) {
    throw new Error("戴回时间必须晚于取下时间。");
  }

  const now = new Date();

  if (params.startAt.getTime() > now.getTime() || params.endAt.getTime() > now.getTime()) {
    throw new Error("补记时间不能晚于当前时间。");
  }

  const db = getDb();
  const [existing] = await db.select().from(offTraySessions)
    .where(and(eq(offTraySessions.userId, params.userId), eq(offTraySessions.id, params.sessionId)))
    .limit(1);

  if (!existing) {
    throw new Error("找不到这条取下记录。");
  }

  if (!existing.endAt) {
    throw new Error("正在进行中的取下记录请在首页处理戴回时间。");
  }

  const overlapping = await db.select().from(offTraySessions)
    .where(and(
      eq(offTraySessions.userId, params.userId),
      lt(offTraySessions.startAt, params.endAt),
      or(isNull(offTraySessions.endAt), gt(offTraySessions.endAt, params.startAt)),
      ne(offTraySessions.id, params.sessionId)
    ))
    .limit(1);

  if (overlapping.length > 0) {
    throw new Error("修改后的时间与已有取下记录重叠，请调整时间。");
  }

  const [session] = await db.update(offTraySessions)
    .set({
      startAt: params.startAt,
      endAt: params.endAt,
      reason: params.reason ?? existing.reason ?? "other",
      reminderAt: null,
      reminderStatus: "none",
      updatedAt: now
    })
    .where(and(eq(offTraySessions.userId, params.userId), eq(offTraySessions.id, params.sessionId)))
    .returning();

  return mapOffTraySession(session);
}

export async function deleteManualOffTraySession(userId: string, sessionId: string) {
  const db = getDb();
  const [existing] = await db.select().from(offTraySessions)
    .where(and(eq(offTraySessions.userId, userId), eq(offTraySessions.id, sessionId)))
    .limit(1);

  if (!existing) {
    throw new Error("找不到这条取下记录。");
  }

  if (!existing.endAt) {
    throw new Error("正在进行中的取下记录请先在首页处理戴回时间。");
  }

  const [deleted] = await db.delete(offTraySessions)
    .where(and(eq(offTraySessions.userId, userId), eq(offTraySessions.id, sessionId)))
    .returning();

  return mapOffTraySession(deleted);
}

export async function startManualActiveOffTraySession(params: {
  userId: string;
  startAt: Date;
  reason?: OffTrayReason;
}) {
  const now = new Date();

  if (params.startAt.getTime() > now.getTime()) {
    throw new Error("补记时间不能晚于当前时间。");
  }

  const db = getDb();
  const state = await getWearState(params.userId);
  const active = await getActiveSession(params.userId);

  if (active || (state && !state.isWearing)) {
    throw new Error("当前已经是取下状态，不需要补记为已取下。");
  }

  const overlapping = await db.select().from(offTraySessions)
    .where(and(
      eq(offTraySessions.userId, params.userId),
      lt(offTraySessions.startAt, now),
      or(isNull(offTraySessions.endAt), gt(offTraySessions.endAt, params.startAt))
    ))
    .limit(1);

  if (overlapping.length > 0) {
    throw new Error("补记时间与已有取下记录重叠，请调整时间。");
  }

  const [session] = await db.insert(offTraySessions).values({
    userId: params.userId,
    startAt: params.startAt,
    endAt: null,
    reason: params.reason ?? "other",
    reminderAt: null,
    reminderStatus: "none",
    createdAt: now,
    updatedAt: now
  }).returning();

  const nextState = {
    isWearing: false,
    currentOffSessionId: session.id,
    lastChangedAt: params.startAt,
    updatedAt: now
  };
  const [updatedState] = state
    ? await db.update(wearStates)
      .set(nextState)
      .where(eq(wearStates.userId, params.userId))
      .returning()
    : await db.insert(wearStates).values({
      userId: params.userId,
      ...nextState
    }).returning();
  await scheduleMealReminderJob(params.userId, session.id, params.startAt);

  return {
    session: mapOffTraySession(session),
    wearState: mapWearState(updatedState)
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

export async function backfillWearTrackingStart(params: {
  userId: string;
  startedAt: Date;
  source?: string | null;
  userAgent?: string | null;
  referer?: string | null;
}) {
  const now = new Date();

  if (params.startedAt.getTime() > now.getTime()) {
    throw new Error("补记时间不能晚于当前时间。");
  }

  const db = getDb();
  const [created] = await db.insert(wearActionLogs).values({
    userId: params.userId,
    action: "end",
    changed: false,
    sessionId: null,
    resultingIsWearing: true,
    requestId: null,
    source: params.source?.slice(0, 80) ?? "manual-wearing-baseline",
    userAgent: params.userAgent ?? null,
    referer: params.referer ?? null,
    createdAt: params.startedAt
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
  const safePatch = {
    startDate: patch.startDate,
    currentTrayNumber: patch.currentTrayNumber,
    totalTrays: patch.totalTrays,
    daysPerTray: patch.daysPerTray,
    dailyGoalMinutes: patch.dailyGoalMinutes
  };
  const [updated] = await db.update(treatmentPlans)
    .set({
      ...safePatch,
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
  const safePatch = {
    enableMealReminder: patch.enableMealReminder,
    mealReminderMinutes: patch.mealReminderMinutes,
    enableBedtimeReminder: patch.enableBedtimeReminder,
    bedtimeReminderTime: patch.bedtimeReminderTime,
    enableTrayChangeReminder: patch.enableTrayChangeReminder
  };
  const [updated] = await db.update(reminderSettings)
    .set({
      ...safePatch,
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

export async function listTreatmentExceptionEvents(userId: string, seriesId: string, limit = 5) {
  const db = getDb();
  const rows = await db.select().from(treatmentExceptionEvents)
    .where(and(eq(treatmentExceptionEvents.userId, userId), eq(treatmentExceptionEvents.seriesId, seriesId)))
    .orderBy(desc(treatmentExceptionEvents.createdAt))
    .limit(limit);

  return rows.map(mapTreatmentExceptionEvent);
}

export async function listActiveTreatmentExceptionEvents(userId: string, seriesId: string, limit = 3) {
  const db = getDb();
  const rows = await db.select().from(treatmentExceptionEvents)
    .where(and(
      eq(treatmentExceptionEvents.userId, userId),
      eq(treatmentExceptionEvents.seriesId, seriesId),
      eq(treatmentExceptionEvents.status, "active")
    ))
    .orderBy(desc(treatmentExceptionEvents.createdAt))
    .limit(limit);

  return rows.map(mapTreatmentExceptionEvent);
}

export async function applyTreatmentException(params: {
  userId: string;
  eventType: TreatmentExceptionType;
  eventDate: string;
  extensionDays?: number | null;
  note?: string | null;
}) {
  const db = getDb();
  const now = new Date();

  return db.transaction(async (tx) => {
    const [series] = await tx.select().from(treatmentSeries)
      .where(and(eq(treatmentSeries.userId, params.userId), eq(treatmentSeries.isActive, true)))
      .orderBy(desc(treatmentSeries.createdAt))
      .limit(1);

    if (!series) {
      throw new Error("No active treatment plan to update.");
    }

    const eventDate = normalizeDateKey(params.eventDate);
    const note = params.note?.trim().slice(0, 1000) ?? "";
    let scheduleAdjusted = false;
    const isExtensionEvent = params.eventType === "extend_current_tray"
      || params.eventType === "tray_extension"
      || params.eventType === "late_change";
    const isWaitingEvent = params.eventType === "waiting_refinement"
      || params.eventType === "waiting_rescan"
      || params.eventType === "waiting_retainer";

    if (isExtensionEvent) {
      const extensionDays = params.extensionDays ?? 0;

      if (!Number.isInteger(extensionDays) || extensionDays < 1 || extensionDays > 30) {
        throw new Error("延长天数需要在 1 到 30 天之间。");
      }

      const trays = await tx.select().from(plannedTrays)
        .where(and(eq(plannedTrays.userId, params.userId), eq(plannedTrays.seriesId, series.id)))
        .orderBy(asc(plannedTrays.trayNumber));
      const currentTray = trays.find((tray) => tray.trayNumber === series.currentTrayNumber);

      if (currentTray) {
        await tx.update(plannedTrays)
          .set({
            plannedEndDate: addDaysToDateKey(currentTray.plannedEndDate, extensionDays),
            status: "extended",
            source: "adjusted",
            note: appendNote(currentTray.note, `延长 ${extensionDays} 天。${note}`),
            updatedAt: now
          })
          .where(eq(plannedTrays.id, currentTray.id));

        const futureTrays = trays.filter((tray) => tray.trayNumber > series.currentTrayNumber);
        await Promise.all(futureTrays.map((tray) => tx.update(plannedTrays)
          .set({
            plannedStartDate: addDaysToDateKey(tray.plannedStartDate, extensionDays),
            plannedEndDate: addDaysToDateKey(tray.plannedEndDate, extensionDays),
            source: "adjusted",
            updatedAt: now
          })
          .where(eq(plannedTrays.id, tray.id))));
      }

      await tx.update(treatmentSeries)
        .set({
          nextChangeDate: series.nextChangeDate ? addDaysToDateKey(series.nextChangeDate, extensionDays) : null,
          clinicianNotes: appendNote(series.clinicianNotes, `当前第 ${series.currentTrayNumber} 副延长 ${extensionDays} 天。${note}`),
          updatedAt: now
        })
        .where(eq(treatmentSeries.id, series.id));
      scheduleAdjusted = true;
    }

    if (isWaitingEvent) {
      const nextStatus = params.eventType === "waiting_retainer" ? "holding" : "waiting_refinement";
      const nextSeriesType = params.eventType === "waiting_retainer" ? "holding" : series.seriesType;
      const waitingLabel = params.eventType === "waiting_retainer"
        ? "等待保持器"
        : params.eventType === "waiting_rescan"
          ? "等待复扫"
          : "等待精修";

      await tx.update(treatmentSeries)
        .set({
          status: nextStatus,
          seriesType: nextSeriesType,
          nextChangeDate: null,
          clinicianNotes: appendNote(series.clinicianNotes, `${waitingLabel}。${note}`),
          updatedAt: now
        })
        .where(eq(treatmentSeries.id, series.id));

      await tx.update(plannedTrays)
        .set({ status: "paused", source: "adjusted", updatedAt: now })
        .where(and(
          eq(plannedTrays.userId, params.userId),
          eq(plannedTrays.seriesId, series.id),
          eq(plannedTrays.trayNumber, series.currentTrayNumber)
        ));
      scheduleAdjusted = true;
    }

    const [event] = await tx.insert(treatmentExceptionEvents).values({
      userId: params.userId,
      seriesId: series.id,
      trayNumber: series.currentTrayNumber,
      eventType: params.eventType,
      eventDate,
      extensionDays: isExtensionEvent ? params.extensionDays ?? null : null,
      note,
      scheduleAdjusted,
      status: "active",
      createdAt: now,
      updatedAt: now
    }).returning();

    const [updatedSeries] = await tx.select().from(treatmentSeries).where(eq(treatmentSeries.id, series.id)).limit(1);
    const trays = await tx.select().from(plannedTrays)
      .where(and(eq(plannedTrays.userId, params.userId), eq(plannedTrays.seriesId, series.id)))
      .orderBy(asc(plannedTrays.trayNumber));

    return {
      event: mapTreatmentExceptionEvent(event),
      series: mapTreatmentSeries(updatedSeries),
      trays: trays.map(mapPlannedTray)
    };
  });
}

export async function updateTreatmentExceptionStatus(params: {
  userId: string;
  eventId: string;
  status: Extract<TreatmentExceptionStatus, "resolved" | "cancelled">;
}) {
  const db = getDb();
  const now = new Date();
  const [event] = await db.update(treatmentExceptionEvents)
    .set({
      status: params.status,
      resolvedAt: params.status === "resolved" ? now : null,
      cancelledAt: params.status === "cancelled" ? now : null,
      updatedAt: now
    })
    .where(and(eq(treatmentExceptionEvents.userId, params.userId), eq(treatmentExceptionEvents.id, params.eventId)))
    .returning();

  if (!event) {
    throw new Error("找不到这条异常记录。");
  }

  return mapTreatmentExceptionEvent(event);
}

export async function advanceActiveTreatmentTray(userId: string, dateKey: string) {
  const db = getDb();
  const now = new Date();
  const confirmedDate = normalizeDateKey(dateKey);

  return db.transaction(async (tx) => {
    const [series] = await tx.select().from(treatmentSeries)
      .where(and(eq(treatmentSeries.userId, userId), eq(treatmentSeries.isActive, true)))
      .orderBy(desc(treatmentSeries.createdAt))
      .limit(1);

    if (!series) {
      throw new Error("还没有可推进的牙套计划。");
    }

    if (series.status !== "active") {
      throw new Error("当前计划处于暂停/等待状态，请先处理异常或更新计划。");
    }

    if (!series.totalTrays || series.currentTrayNumber >= series.totalTrays) {
      throw new Error("当前已经是本阶段最后一副，请按医生安排导入下一阶段或记录等待状态。");
    }

    if (series.nextChangeDate && confirmedDate < series.nextChangeDate) {
      throw new Error("还没到计划换期日；如果医生要求提前或延后，请用异常处理记录。");
    }

    const nextTrayNumber = series.currentTrayNumber + 1;
    const nextChangeDate = addDaysToDateKey(confirmedDate, series.trayIntervalDays);
    const [nextTray] = await tx.select().from(plannedTrays)
      .where(and(
        eq(plannedTrays.userId, userId),
        eq(plannedTrays.seriesId, series.id),
        eq(plannedTrays.trayNumber, nextTrayNumber)
      ))
      .limit(1);
    const shiftDays = nextTray
      ? dateKeyDiff(confirmedDate, nextTray.plannedStartDate)
      : 0;

    await tx.update(plannedTrays)
      .set({ status: "completed", updatedAt: now })
      .where(and(
        eq(plannedTrays.userId, userId),
        eq(plannedTrays.seriesId, series.id),
        eq(plannedTrays.trayNumber, series.currentTrayNumber)
      ));

    await tx.update(plannedTrays)
      .set({
        status: "current",
        plannedStartDate: confirmedDate,
        plannedEndDate: addDaysToDateKey(confirmedDate, series.trayIntervalDays - 1),
        source: "adjusted",
        updatedAt: now
      })
      .where(and(
        eq(plannedTrays.userId, userId),
        eq(plannedTrays.seriesId, series.id),
        eq(plannedTrays.trayNumber, nextTrayNumber)
      ));

    if (shiftDays !== 0) {
      const futureTrays = await tx.select().from(plannedTrays)
        .where(and(
          eq(plannedTrays.userId, userId),
          eq(plannedTrays.seriesId, series.id),
          gt(plannedTrays.trayNumber, nextTrayNumber)
        ));

      await Promise.all(futureTrays.map((tray) => tx.update(plannedTrays)
        .set({
          plannedStartDate: addDaysToDateKey(tray.plannedStartDate, shiftDays),
          plannedEndDate: addDaysToDateKey(tray.plannedEndDate, shiftDays),
          source: "adjusted",
          updatedAt: now
        })
        .where(eq(plannedTrays.id, tray.id))));
    }

    const [updatedSeries] = await tx.update(treatmentSeries)
      .set({
        currentTrayNumber: nextTrayNumber,
        currentTrayStartDate: confirmedDate,
        nextChangeDate,
        updatedAt: now
      })
      .where(eq(treatmentSeries.id, series.id))
      .returning();

    await tx.update(treatmentPlans)
      .set({
        currentTrayNumber: nextTrayNumber,
        updatedAt: now
      })
      .where(eq(treatmentPlans.userId, userId));

    const trays = await tx.select().from(plannedTrays)
      .where(and(eq(plannedTrays.userId, userId), eq(plannedTrays.seriesId, series.id)))
      .orderBy(asc(plannedTrays.trayNumber));

    return {
      series: mapTreatmentSeries(updatedSeries),
      trays: trays.map(mapPlannedTray)
    };
  });
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

    await tx.update(treatmentExceptionEvents)
      .set({
        status: "resolved",
        resolvedAt: now,
        cancelledAt: null,
        updatedAt: now
      })
      .where(and(
        eq(treatmentExceptionEvents.userId, userId),
        eq(treatmentExceptionEvents.seriesId, series.id),
        eq(treatmentExceptionEvents.status, "active")
      ));

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

export async function upsertPushSubscription(params: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}) {
  const db = getDb();
  const now = new Date();
  const [subscription] = await db.insert(pushSubscriptions).values({
    userId: params.userId,
    endpoint: params.endpoint,
    p256dh: params.p256dh,
    auth: params.auth,
    userAgent: params.userAgent ?? null,
    status: "active",
    createdAt: now,
    updatedAt: now
  }).onConflictDoUpdate({
    target: pushSubscriptions.endpoint,
    set: {
      userId: params.userId,
      p256dh: params.p256dh,
      auth: params.auth,
      userAgent: params.userAgent ?? null,
      status: "active",
      updatedAt: now
    }
  }).returning();

  return mapPushSubscription(subscription);
}

export async function disablePushSubscription(userId: string, endpoint: string) {
  const db = getDb();
  const now = new Date();
  const [subscription] = await db.update(pushSubscriptions)
    .set({ status: "disabled", updatedAt: now })
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
    .returning();

  return subscription ? mapPushSubscription(subscription) : null;
}

export async function listActivePushSubscriptions(userId: string) {
  const db = getDb();
  const rows = await db.select().from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.status, "active")))
    .orderBy(desc(pushSubscriptions.updatedAt));

  return rows.map(mapPushSubscription);
}

export async function markPushSubscriptionExpired(endpoint: string) {
  const db = getDb();
  const now = new Date();

  await db.update(pushSubscriptions)
    .set({ status: "expired", updatedAt: now })
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function markPushSubscriptionUsed(endpoint: string) {
  const db = getDb();
  const now = new Date();

  await db.update(pushSubscriptions)
    .set({ lastUsedAt: now, updatedAt: now })
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function scheduleMealReminderJob(userId: string, sessionId: string, startedAt: Date) {
  const settings = await getOrCreateReminderSettings(userId);

  if (!settings.enableMealReminder) {
    return null;
  }

  const db = getDb();
  const now = new Date();
  const dueAt = new Date(startedAt.getTime() + settings.mealReminderMinutes * 60_000);
  const [job] = await db.insert(reminderJobs).values({
    userId,
    sessionId,
    kind: "off_tray_return",
    dueAt,
    status: "scheduled",
    attempts: 0,
    createdAt: now,
    updatedAt: now
  }).onConflictDoUpdate({
    target: [reminderJobs.sessionId, reminderJobs.kind],
    set: {
      dueAt,
      status: "scheduled",
      attempts: 0,
      lastError: null,
      sentAt: null,
      updatedAt: now
    }
  }).returning();

  const reminderJob = mapReminderJob(job);
  await scheduleReminderDelivery(reminderJob).catch((error) => {
    console.error("Failed to schedule delayed reminder delivery.", error);
  });

  return reminderJob;
}

export async function cancelReminderJobsForSession(userId: string, sessionId: string) {
  const db = getDb();
  const now = new Date();
  const rows = await db.update(reminderJobs)
    .set({ status: "cancelled", updatedAt: now })
    .where(and(
      eq(reminderJobs.userId, userId),
      eq(reminderJobs.sessionId, sessionId),
      eq(reminderJobs.status, "scheduled")
    ))
    .returning();

  return rows.map(mapReminderJob);
}

export async function listDueReminderJobs(limit = 25) {
  const db = getDb();
  const rows = await db.select().from(reminderJobs)
    .where(and(eq(reminderJobs.status, "scheduled"), lte(reminderJobs.dueAt, new Date())))
    .orderBy(asc(reminderJobs.dueAt))
    .limit(limit);

  return rows.map(mapReminderJob);
}

export async function getScheduledReminderJobForSession(userId: string, sessionId: string) {
  const db = getDb();
  const [row] = await db.select().from(reminderJobs)
    .where(and(
      eq(reminderJobs.userId, userId),
      eq(reminderJobs.sessionId, sessionId),
      eq(reminderJobs.kind, "off_tray_return"),
      eq(reminderJobs.status, "scheduled")
    ))
    .limit(1);

  return row ? mapReminderJob(row) : null;
}

export async function markReminderJobSent(jobId: string) {
  const db = getDb();
  const now = new Date();
  const [job] = await db.update(reminderJobs)
    .set({ status: "sent", sentAt: now, updatedAt: now })
    .where(eq(reminderJobs.id, jobId))
    .returning();

  return mapReminderJob(job);
}

export async function markReminderJobFailed(jobId: string, error: string) {
  const db = getDb();
  const now = new Date();
  const [existing] = await db.select().from(reminderJobs).where(eq(reminderJobs.id, jobId)).limit(1);
  const [job] = await db.update(reminderJobs)
    .set({
      status: "failed",
      attempts: (existing?.attempts ?? 0) + 1,
      lastError: error.slice(0, 1000),
      updatedAt: now
    })
    .where(eq(reminderJobs.id, jobId))
    .returning();

  return mapReminderJob(job);
}

function normalizeDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("日期格式必须是 YYYY-MM-DD。");
  }

  return value;
}

function appendNote(existing: string, next: string) {
  const cleanNext = next.trim();

  if (!cleanNext) {
    return existing;
  }

  return [existing.trim(), cleanNext].filter(Boolean).join("\n");
}

function dateKeyDiff(left: string, right: string) {
  const [leftYear, leftMonth, leftDay] = left.split("-").map(Number);
  const [rightYear, rightMonth, rightDay] = right.split("-").map(Number);
  const leftMs = Date.UTC(leftYear, leftMonth - 1, leftDay);
  const rightMs = Date.UTC(rightYear, rightMonth - 1, rightDay);

  return Math.round((leftMs - rightMs) / 86_400_000);
}
