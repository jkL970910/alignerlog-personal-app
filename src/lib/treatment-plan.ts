import { addDays, differenceInCalendarDays, differenceInHours, format, parseISO, subDays } from "date-fns";

import { zonedDateTimeToUtc } from "./dates";
import { todayKey as getTodayKey } from "./dates";
import type {
  AppointmentExtensionSuggestion,
  PlanProgress,
  PlannedTrayDraft,
  PlannedTrayStatus,
  TreatmentPlanImportInput,
  TreatmentPlanImportPreview,
  TreatmentStatus
} from "./types";

export const treatmentSafetyNote = "Loo牙管理器只生成计划日程和记录提醒，不提供诊断或换牙套决策；牙套不贴合、疼痛、损坏、丢失或是否换下一副，请以牙医/正畸医生指导为准。";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function buildTreatmentPlanImportPreview(input: TreatmentPlanImportInput, today = new Date(), timeZone = "UTC"): TreatmentPlanImportPreview {
  const normalized = normalizeImportInput(input);
  const todayKey = getTodayKey(today, timeZone);
  const currentTrayStartDate = normalized.currentTrayStartDate
    ? parseDate(normalized.currentTrayStartDate)
    : subDays(parseDate(normalized.nextChangeDate as string), normalized.trayIntervalDays - 1);
  const startDate = normalized.startDate
    ? parseDate(normalized.startDate)
    : subDays(currentTrayStartDate, (normalized.currentTrayNumber - 1) * normalized.trayIntervalDays);
  const trays = buildTrayDrafts({
    currentTrayNumber: normalized.currentTrayNumber,
    currentTrayStartDate: dateKey(currentTrayStartDate),
    totalTrays: normalized.totalTrays,
    trayIntervalDays: normalized.trayIntervalDays,
    status: normalized.status,
    todayKey
  });
  const progress = calculatePlanProgress({
    status: normalized.status,
    currentTrayNumber: normalized.currentTrayNumber,
    totalTrays: normalized.totalTrays,
    overallTotalTrays: normalized.overallTotalTrays ?? normalized.totalTrays,
    overallTreatmentDays: normalized.overallTreatmentDays ?? null,
    trayIntervalDays: normalized.trayIntervalDays,
    currentTrayStartDate: dateKey(currentTrayStartDate),
    nextChangeDate: normalized.nextChangeDate,
    trays,
    todayKey,
    today,
    timeZone
  });
  const appointmentExtensionSuggestion = getAppointmentExtensionSuggestion({
    currentTrayNumber: normalized.currentTrayNumber,
    totalTrays: normalized.totalTrays,
    appointmentDate: normalized.appointmentDate,
    trays
  });

  return {
    series: {
      name: normalized.name,
      status: normalized.status,
      seriesType: normalized.seriesType,
      startDate: dateKey(startDate),
      currentTrayNumber: normalized.currentTrayNumber,
      totalTrays: normalized.totalTrays,
      overallTotalTrays: normalized.overallTotalTrays ?? normalized.totalTrays,
      overallTreatmentDays: normalized.overallTreatmentDays ?? null,
      trayIntervalDays: normalized.trayIntervalDays,
      dailyGoalMinutes: normalized.dailyGoalMinutes,
      currentTrayStartDate: dateKey(currentTrayStartDate),
      nextChangeDate: normalized.nextChangeDate ?? progress.nextChangeDate,
      appointmentDate: normalized.appointmentDate ?? null,
      clinicianNotes: normalized.clinicianNotes ?? "",
      isActive: true
    },
    trays,
    progress,
    appointmentExtensionSuggestion,
    safetyNote: treatmentSafetyNote
  };
}

export function getAppointmentExtensionSuggestion(params: {
  currentTrayNumber: number;
  totalTrays: number | null;
  appointmentDate?: string | null;
  trays: Array<Pick<PlannedTrayDraft, "trayNumber" | "plannedEndDate">>;
}): AppointmentExtensionSuggestion | null {
  if (!params.totalTrays || params.currentTrayNumber !== params.totalTrays || !params.appointmentDate) {
    return null;
  }

  validateDateKey(params.appointmentDate);

  const lastTray = params.trays.find((tray) => tray.trayNumber === params.currentTrayNumber);

  if (!lastTray || params.appointmentDate <= lastTray.plannedEndDate) {
    return null;
  }

  return {
    kind: "extend_last_tray_to_appointment",
    trayNumber: params.currentTrayNumber,
    plannedEndDate: lastTray.plannedEndDate,
    appointmentDate: params.appointmentDate,
    extensionDays: dateKeyDiff(params.appointmentDate, lastTray.plannedEndDate)
  };
}

export function calculatePlanProgress(params: {
  status: TreatmentStatus;
  currentTrayNumber: number;
  totalTrays: number | null;
  overallTotalTrays?: number | null;
  overallTreatmentDays?: number | null;
  trayIntervalDays: number;
  currentTrayStartDate: string;
  nextChangeDate?: string | null;
  trays?: PlannedTrayDraft[];
  today?: Date;
  todayKey?: string;
  timeZone?: string;
}): PlanProgress {
  const now = params.today ?? new Date();
  const timeZone = params.timeZone ?? "UTC";
  const todayKey = params.todayKey ?? getTodayKey(params.today ?? new Date(), params.timeZone);
  const currentStart = parseDate(params.currentTrayStartDate);
  const currentTrayDay = Math.max(1, differenceInCalendarDays(parseDate(todayKey), currentStart) + 1);
  const generatedNext = dateKey(addDays(currentStart, params.trayIntervalDays));
  const nextChangeDate = params.nextChangeDate ?? generatedNext;
  const daysUntilNextChange = differenceInCalendarDays(parseDate(nextChangeDate), parseDate(todayKey));
  const estimatedSeriesEndDate = params.trays?.at(-1)?.plannedEndDate
    ?? (params.totalTrays ? dateKey(addDays(currentStart, (params.totalTrays - params.currentTrayNumber + 1) * params.trayIntervalDays - 1)) : null);
  const currentTrayHourlyProgress = getCurrentTrayHourlyProgress({
    currentTrayStartDate: params.currentTrayStartDate,
    nextChangeDate,
    now,
    timeZone
  });
  const paused = isPausedStatus(params.status);

  return {
    status: params.status,
    currentTrayNumber: params.currentTrayNumber,
    totalTrays: params.totalTrays,
    overallTotalTrays: params.overallTotalTrays ?? params.totalTrays,
    overallTreatmentDays: params.overallTreatmentDays ?? null,
    currentTrayDay: paused ? null : currentTrayDay,
    currentTrayElapsedHours: paused ? null : currentTrayHourlyProgress.elapsedHours,
    currentTrayTotalHours: paused ? null : currentTrayHourlyProgress.totalHours,
    currentTrayProgressPercent: paused ? null : currentTrayHourlyProgress.progressPercent,
    trayIntervalDays: params.trayIntervalDays,
    daysUntilNextChange: paused ? null : daysUntilNextChange,
    traysRemaining: params.totalTrays ? Math.max(0, params.totalTrays - params.currentTrayNumber) : null,
    nextChangeDate: paused ? null : nextChangeDate,
    estimatedSeriesEndDate,
    label: getProgressLabel(params.status)
  };
}

function buildTrayDrafts(params: {
  currentTrayNumber: number;
  currentTrayStartDate: string;
  totalTrays: number;
  trayIntervalDays: number;
  status: TreatmentStatus;
  todayKey: string;
}): PlannedTrayDraft[] {
  const currentStart = parseDate(params.currentTrayStartDate);
  const drafts: PlannedTrayDraft[] = [];

  for (let trayNumber = 1; trayNumber <= params.totalTrays; trayNumber += 1) {
    const offset = trayNumber - params.currentTrayNumber;
    const plannedStart = addDays(currentStart, offset * params.trayIntervalDays);
    const plannedEnd = addDays(plannedStart, params.trayIntervalDays - 1);

    drafts.push({
      trayNumber,
      plannedStartDate: dateKey(plannedStart),
      plannedEndDate: dateKey(plannedEnd),
      status: getTrayStatus({
        trayNumber,
        currentTrayNumber: params.currentTrayNumber,
        status: params.status,
        plannedEndDate: dateKey(plannedEnd),
        todayKey: params.todayKey
      }),
      source: trayNumber === params.currentTrayNumber ? "imported" : "generated",
      note: ""
    });
  }

  return drafts;
}

function getTrayStatus(params: {
  trayNumber: number;
  currentTrayNumber: number;
  status: TreatmentStatus;
  plannedEndDate: string;
  todayKey: string;
}): PlannedTrayStatus {
  if (params.status === "holding" || params.status === "waiting_refinement") {
    return params.trayNumber === params.currentTrayNumber ? "paused" : "upcoming";
  }

  if (params.trayNumber < params.currentTrayNumber) {
    return "completed";
  }

  if (params.trayNumber > params.currentTrayNumber) {
    return "upcoming";
  }

  return params.plannedEndDate < params.todayKey ? "extended" : "current";
}

function normalizeImportInput(input: TreatmentPlanImportInput): TreatmentPlanImportInput {
  if (!input.name.trim()) {
    throw new Error("请输入阶段名称。");
  }

  if (!Number.isInteger(input.currentTrayNumber) || input.currentTrayNumber < 1) {
    throw new Error("当前牙套副数必须大于 0。");
  }

  if (!Number.isInteger(input.totalTrays) || input.totalTrays < input.currentTrayNumber) {
    throw new Error("总副数不能小于当前副数。");
  }

  if (input.overallTotalTrays !== undefined && (!Number.isInteger(input.overallTotalTrays) || input.overallTotalTrays < input.currentTrayNumber)) {
    throw new Error("整体疗程预估副数不能小于当前副数。");
  }

  if (input.overallTreatmentDays !== undefined && (!Number.isInteger(input.overallTreatmentDays) || input.overallTreatmentDays < 1)) {
    throw new Error("整体疗程预估天数必须大于 0 天。");
  }

  if (!Number.isInteger(input.trayIntervalDays) || input.trayIntervalDays < 1 || input.trayIntervalDays > 30) {
    throw new Error("每副佩戴天数需要在 1 到 30 天之间。");
  }

  if (!Number.isInteger(input.dailyGoalMinutes) || input.dailyGoalMinutes < 60 || input.dailyGoalMinutes > 1440) {
    throw new Error("每日目标需要在 60 到 1440 分钟之间。");
  }

  if (!input.currentTrayStartDate && !input.nextChangeDate) {
    throw new Error("请填写当前副开始日期或下次换牙套日期。");
  }

  [input.startDate, input.currentTrayStartDate, input.nextChangeDate, input.appointmentDate]
    .filter(Boolean)
    .forEach((value) => validateDateKey(value as string));

  return {
    ...input,
    name: input.name.trim(),
    clinicianNotes: input.clinicianNotes?.trim() ?? ""
  };
}

function getProgressLabel(status: TreatmentStatus): PlanProgress["label"] {
  if (status === "not_started") {
    return "not_started";
  }

  if (status === "holding" || status === "waiting_refinement") {
    return status === "holding" ? "holding" : "paused";
  }

  if (status === "retainer") {
    return "retainer";
  }

  return "on_track";
}

function isPausedStatus(status: TreatmentStatus) {
  return status === "holding" || status === "waiting_refinement" || status === "retainer";
}

function validateDateKey(value: string) {
  if (!datePattern.test(value) || Number.isNaN(parseISO(value).getTime())) {
    throw new Error("日期格式必须是 YYYY-MM-DD。");
  }
}

function parseDate(value: string) {
  validateDateKey(value);
  return parseISO(value);
}

function dateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function getCurrentTrayHourlyProgress(params: {
  currentTrayStartDate: string;
  nextChangeDate: string;
  now: Date;
  timeZone: string;
}) {
  const start = zonedDateTimeToUtc(params.currentTrayStartDate, 0, 0, 0, params.timeZone);
  const end = zonedDateTimeToUtc(params.nextChangeDate, 0, 0, 0, params.timeZone);
  const totalHours = Math.max(1, differenceInHours(end, start));
  const elapsedHours = Math.min(totalHours, Math.max(0, differenceInHours(params.now, start)));

  return {
    elapsedHours,
    totalHours,
    progressPercent: clampPercent((elapsedHours / totalHours) * 100)
  };
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function dateKeyDiff(left: string, right: string) {
  const [leftYear, leftMonth, leftDay] = left.split("-").map(Number);
  const [rightYear, rightMonth, rightDay] = right.split("-").map(Number);
  const leftMs = Date.UTC(leftYear, leftMonth - 1, leftDay);
  const rightMs = Date.UTC(rightYear, rightMonth - 1, rightDay);

  return Math.round((leftMs - rightMs) / 86_400_000);
}
