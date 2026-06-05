"use client";

import { addDays, format, isValid, parseISO, subDays } from "date-fns";
import { useEffect, useState } from "react";
import { Bell, Cloud, Download, Loader2, Sparkles, Timer } from "lucide-react";

import type { PlanProgress, ReminderSettings, TreatmentExceptionEvent, TreatmentExceptionType, TreatmentPlan, TreatmentPlanImportInput, TreatmentPlanImportPreview, TreatmentSeries, TreatmentSeriesType, TreatmentStatus } from "@/lib/types";
import { formatMinutes } from "@/lib/format";
import {
  getClientDateKey,
  getClientTimeZone,
  getDetectedTimeZone,
  isTimeZoneManuallySet,
  resetClientTimeZone,
  setClientTimeZone,
  timeZoneHeaders
} from "@/lib/client-time-zone";

import { LogoutButton } from "./logout-button";
import { PushNotificationCard } from "./push-notification-card";
import { SetupWarning } from "./setup-warning";

type SettingsPayload = {
  treatmentPlan: TreatmentPlan;
  reminderSettings: ReminderSettings;
  activeSeries: TreatmentSeries | null;
  planProgress: PlanProgress | null;
  exceptionEvents: TreatmentExceptionEvent[];
};

type ImportState = TreatmentPlanImportInput;
type PlanSetupMode = "new" | "import";
type NumberPickerState = {
  title: string;
  helper?: string;
  value: number;
  options: number[];
  formatValue?: (value: number) => string;
  onSelect: (value: number) => void;
} | null;

const timeZoneOptions = [
  "America/Toronto",
  "America/New_York",
  "America/Vancouver",
  "America/Los_Angeles",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "UTC"
];

const mealReminderMinuteOptions = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180];

const exceptionOptions: Array<{ value: TreatmentExceptionType; label: string; helper: string }> = [
  { value: "late_change", label: "延迟换期", helper: "已经晚于原计划换到下一副，顺延当前和后续日程。" },
  { value: "tray_extension", label: "当前副延戴", helper: "按医生要求继续多戴当前副，并顺延后续日程。" },
  { value: "poor_fit", label: "牙套不贴合", helper: "创建阻塞提醒，不自动建议换副或回退。" },
  { value: "lost_tray", label: "牙套丢失", helper: "只记录事件，请按医生/诊所指示处理。" },
  { value: "broken_tray", label: "牙套损坏", helper: "只记录事件，请按医生/诊所指示处理。" },
  { value: "waiting_refinement", label: "等待精修", helper: "暂停当前换期，等待下一阶段计划。" },
  { value: "waiting_rescan", label: "等待复扫", helper: "暂停当前换期，等待医生复扫或确认。" },
  { value: "waiting_retainer", label: "等待保持器", helper: "暂停当前换期，记录为等待保持器。" }
];

function createDefaultImport(mode: PlanSetupMode = "import", dailyGoalMinutes = 1320): ImportState {
  const today = getClientDateKey();
  const isNewPlan = mode === "new";

  return {
    status: isNewPlan ? "not_started" : "active",
    seriesType: "active",
    name: isNewPlan ? "新牙套计划" : "当前阶段",
    currentTrayNumber: 1,
    totalTrays: 1,
    overallTotalTrays: 1,
    overallTreatmentDays: 7,
    trayIntervalDays: 7,
    dailyGoalMinutes,
    currentTrayStartDate: today,
    nextChangeDate: addDaysKey(today, 7),
    clinicianNotes: ""
  };
}

function createImportFromSeries(series: TreatmentSeries, dailyGoalMinutes: number): ImportState {
  const base = createDefaultImport("import", dailyGoalMinutes);

  return {
    ...base,
    status: series.status,
    seriesType: series.seriesType,
    name: series.name,
    startDate: series.startDate,
    currentTrayNumber: series.currentTrayNumber,
    totalTrays: series.totalTrays ?? base.totalTrays,
    overallTotalTrays: series.overallTotalTrays ?? series.totalTrays ?? base.totalTrays,
    overallTreatmentDays: series.overallTreatmentDays ?? undefined,
    trayIntervalDays: series.trayIntervalDays,
    dailyGoalMinutes: series.dailyGoalMinutes,
    currentTrayStartDate: series.currentTrayStartDate,
    nextChangeDate: series.nextChangeDate ?? undefined,
    appointmentDate: series.appointmentDate ?? undefined,
    clinicianNotes: series.clinicianNotes
  };
}

export function SettingsDashboard() {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [goalPending, setGoalPending] = useState(false);
  const [goalDirty, setGoalDirty] = useState(false);
  const [goalMessage, setGoalMessage] = useState<string | null>(null);
  const [importDraft, setImportDraft] = useState<ImportState>(() => createDefaultImport());
  const [importPreview, setImportPreview] = useState<TreatmentPlanImportPreview | null>(null);
  const [importPending, setImportPending] = useState(false);
  const [importDraftInitialized, setImportDraftInitialized] = useState(false);
  const [planSetupMode, setPlanSetupMode] = useState<PlanSetupMode | null>(null);
  const [planEditorOpen, setPlanEditorOpen] = useState(false);
  const [editingExistingPlan, setEditingExistingPlan] = useState(false);
  const [resetConfirmArmed, setResetConfirmArmed] = useState(false);
  const [numberPicker, setNumberPicker] = useState<NumberPickerState>(null);
  const [timeZone, setTimeZone] = useState(() => getClientTimeZone());
  const [manualTimeZone, setManualTimeZone] = useState(() => isTimeZoneManuallySet());
  const [reminderPending, setReminderPending] = useState(false);
  const [reminderDirty, setReminderDirty] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [exceptionOpen, setExceptionOpen] = useState(false);
  const [exceptionPending, setExceptionPending] = useState(false);
  const [exceptionType, setExceptionType] = useState<TreatmentExceptionType>("tray_extension");
  const [exceptionDate, setExceptionDate] = useState(() => getClientDateKey());
  const [exceptionDays, setExceptionDays] = useState(1);
  const [exceptionNote, setExceptionNote] = useState("");
  const [exceptionMessage, setExceptionMessage] = useState<string | null>(null);
  const [exceptionActionPendingId, setExceptionActionPendingId] = useState<string | null>(null);

  useEffect(() => {
    loadSettings().catch((err: Error) => setError(err.message));
  }, []);

  async function loadSettings() {
    const response = await fetch("/api/settings", { headers: timeZoneHeaders() });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "无法载入设置。");
    }

    setSettings(payload);
  }

  async function changeTimeZone(nextTimeZone: string) {
    const next = setClientTimeZone(nextTimeZone);

    setTimeZone(next);
    setManualTimeZone(true);
    await loadSettings();
  }

  async function resetToDetectedTimeZone() {
    const detected = resetClientTimeZone();

    setTimeZone(detected);
    setManualTimeZone(false);
    await loadSettings();
  }

  useEffect(() => {
    if (!settings || importDraftInitialized) {
      return;
    }

    const activeSeries = settings.activeSeries;
    const base = createDefaultImport("import", settings.treatmentPlan.dailyGoalMinutes);

    if (activeSeries) {
      setImportDraft(createImportFromSeries(activeSeries, settings.treatmentPlan.dailyGoalMinutes));
      setPlanSetupMode(activeSeries.currentTrayNumber > 1 ? "import" : "new");
      setPlanEditorOpen(false);
      setEditingExistingPlan(false);
    } else {
      setImportDraft(base);
      setPlanSetupMode(null);
      setPlanEditorOpen(false);
      setEditingExistingPlan(false);
    }
    setImportDraftInitialized(true);
  }, [importDraftInitialized, settings]);

  async function saveDailyGoal() {
    if (!settings) {
      return;
    }

    setGoalPending(true);
    setGoalMessage(null);

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: timeZoneHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          treatmentPlan: {
            startDate: settings.treatmentPlan.startDate,
            currentTrayNumber: settings.treatmentPlan.currentTrayNumber,
            totalTrays: settings.treatmentPlan.totalTrays,
            daysPerTray: settings.treatmentPlan.daysPerTray,
            dailyGoalMinutes: settings.treatmentPlan.dailyGoalMinutes
          }
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "无法保存每日目标。");
      }

      setSettings(payload);
      setGoalDirty(false);
      setGoalMessage("已保存每日目标。");
    } catch (err) {
      setGoalMessage(err instanceof Error ? err.message : "无法保存每日目标。");
    } finally {
      setGoalPending(false);
    }
  }

  async function saveReminderPreferences() {
    if (!settings) {
      return;
    }

    setReminderPending(true);
    setReminderMessage(null);

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: timeZoneHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          reminderSettings: {
            enableMealReminder: settings.reminderSettings.enableMealReminder,
            mealReminderMinutes: settings.reminderSettings.mealReminderMinutes,
            enableBedtimeReminder: settings.reminderSettings.enableBedtimeReminder,
            bedtimeReminderTime: settings.reminderSettings.bedtimeReminderTime,
            enableTrayChangeReminder: settings.reminderSettings.enableTrayChangeReminder
          }
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "无法保存提醒偏好。");
      }

      setSettings(payload);
      setReminderDirty(false);
      setReminderMessage("已保存提醒偏好。");
    } catch (err) {
      setReminderMessage(err instanceof Error ? err.message : "无法保存提醒偏好。");
    } finally {
      setReminderPending(false);
    }
  }

  async function previewImport() {
    setImportPending(true);
    setError(null);

    try {
      const response = await fetch("/api/treatment-plan/import", {
        method: "POST",
        headers: timeZoneHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ mode: "preview", plan: normalizeImportDraft(importDraft) })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "无法生成计划预览。");
      }

      setImportPreview(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法生成计划预览。");
    } finally {
      setImportPending(false);
    }
  }

  async function savePlan() {
    setImportPending(true);
    setError(null);

    try {
      const mode = settings?.activeSeries
        ? editingExistingPlan ? "update" : "reset"
        : "confirm";
      const response = await fetch("/api/treatment-plan/import", {
        method: "POST",
        headers: timeZoneHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ mode, plan: normalizeImportDraft(importDraft) })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "无法保存牙套计划。");
      }

      setImportPreview(payload);
      setSettings(settings ? {
        ...settings,
        activeSeries: payload.series,
        planProgress: payload.progress,
        treatmentPlan: {
          ...settings.treatmentPlan,
          startDate: payload.series.startDate,
          currentTrayNumber: payload.series.currentTrayNumber,
          totalTrays: payload.series.totalTrays,
          daysPerTray: payload.series.trayIntervalDays,
          dailyGoalMinutes: payload.series.dailyGoalMinutes
        }
      } : settings);
      setPlanEditorOpen(false);
      setEditingExistingPlan(false);
      setResetConfirmArmed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法保存牙套计划。");
    } finally {
      setImportPending(false);
    }
  }

  function choosePlanSetupMode(mode: PlanSetupMode) {
    setPlanSetupMode(mode);
    setPlanEditorOpen(true);
    setEditingExistingPlan(false);
    setResetConfirmArmed(false);
    setImportPreview(null);
    setImportDraft(createDefaultImport(mode, settings?.treatmentPlan.dailyGoalMinutes ?? 1320));
  }

  function editCurrentPlan() {
    if (settings?.activeSeries) {
      setImportDraft(createImportFromSeries(settings.activeSeries, settings.treatmentPlan.dailyGoalMinutes));
      setPlanSetupMode(settings.activeSeries.currentTrayNumber > 1 ? "import" : "new");
    } else {
      setPlanSetupMode(planSetupMode ?? "import");
    }
    setPlanEditorOpen(true);
    setEditingExistingPlan(true);
    setResetConfirmArmed(false);
    setImportPreview(null);
  }

  function armPlanReset(mode: PlanSetupMode) {
    choosePlanSetupMode(mode);
    setResetConfirmArmed(true);
  }

  async function saveException() {
    if (!settings?.activeSeries) {
      return;
    }

    setExceptionPending(true);
    setExceptionMessage(null);

    try {
      const response = await fetch("/api/treatment-plan/exception", {
        method: "POST",
        headers: timeZoneHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          eventType: exceptionType,
          eventDate: exceptionDate,
          extensionDays: isExtensionException(exceptionType) ? exceptionDays : undefined,
          note: exceptionNote
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "无法保存异常记录。");
      }

      setSettings({
        ...settings,
        activeSeries: payload.series,
        planProgress: payload.progress,
        exceptionEvents: [payload.event, ...settings.exceptionEvents].slice(0, 5)
      });
      setExceptionMessage("已记录异常处理。");
      setExceptionNote("");
      setExceptionOpen(false);
    } catch (err) {
      setExceptionMessage(err instanceof Error ? err.message : "无法保存异常记录。");
    } finally {
      setExceptionPending(false);
    }
  }

  async function updateException(eventId: string, action: "resolve" | "cancel") {
    if (!settings) {
      return;
    }

    setExceptionActionPendingId(eventId);
    setExceptionMessage(null);

    try {
      const response = await fetch("/api/treatment-plan/exception", {
        method: "PATCH",
        headers: timeZoneHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ eventId, action })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "无法更新异常记录。");
      }

      setSettings({
        ...settings,
        exceptionEvents: settings.exceptionEvents.map((event) => event.id === eventId ? payload.event : event)
      });
      setExceptionMessage(action === "resolve" ? "已标记异常解决。" : "已取消异常记录。");
    } catch (err) {
      setExceptionMessage(err instanceof Error ? err.message : "无法更新异常记录。");
    } finally {
      setExceptionActionPendingId(null);
    }
  }

  function updateImportDraft(next: ImportState) {
    setImportDraft(next);
    setImportPreview(null);
  }

  function updateImportSchedule(patch: Partial<ImportState>) {
    const next = { ...importDraft, ...patch };
    const currentStartTouched = Object.prototype.hasOwnProperty.call(patch, "currentTrayStartDate");
    const nextChangeTouched = Object.prototype.hasOwnProperty.call(patch, "nextChangeDate");
    const intervalTouched = Object.prototype.hasOwnProperty.call(patch, "trayIntervalDays");

    if ((currentStartTouched || intervalTouched) && next.currentTrayStartDate && next.trayIntervalDays > 0) {
      next.nextChangeDate = addDaysKey(next.currentTrayStartDate, next.trayIntervalDays);
    } else if (nextChangeTouched && next.nextChangeDate && next.trayIntervalDays > 0) {
      next.currentTrayStartDate = subDaysKey(next.nextChangeDate, next.trayIntervalDays - 1);
    }

    updateImportDraft(next);
  }

  if (error) {
    return <SetupWarning message={error} />;
  }

  if (!settings) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-md border border-ink/10 bg-white/75">
        <Loader2 className="h-6 w-6 animate-spin text-sage" />
      </div>
    );
  }

  const hasRealPlan = Boolean(settings.activeSeries);
  const progress = settings.planProgress;
  const isNewPlanMode = planSetupMode === "new";
  const showPlanEditor = Boolean(planEditorOpen && planSetupMode);
  const planEditorTitle = hasRealPlan && editingExistingPlan ? "修改当前计划" : isNewPlanMode ? "开始新计划" : "导入已进行计划";
  const detectedTimeZone = getDetectedTimeZone();
  const exportTimeZone = encodeURIComponent(timeZone);

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-amber/20 bg-white p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-mist text-amber">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink">佩戴目标与牙套计划</h2>
            <p className="mt-1 text-sm leading-6 text-ink/60">
              每日目标用于打卡统计；牙套计划只展示你确认保存过的真实计划，不再把新账号默认值当作当前计划。
            </p>
          </div>
        </div>

        <NumberPickerField
          className="mt-4"
          helper="默认 22 小时，可按医生要求调整。"
          label="每日佩戴目标"
          onOpen={() => setNumberPicker({
            title: "每日佩戴目标",
            helper: "选择医生要求的每日佩戴目标。",
            value: settings.treatmentPlan.dailyGoalMinutes,
            options: minuteOptions(),
            formatValue: formatMinutes,
            onSelect: (value) => {
              setSettings({
                ...settings,
                treatmentPlan: {
                  ...settings.treatmentPlan,
                  dailyGoalMinutes: value
                }
              });
              setGoalDirty(true);
              setGoalMessage(null);
            }
          })}
          value={formatMinutes(settings.treatmentPlan.dailyGoalMinutes)}
        />
        {goalDirty ? (
          <p className="mt-3 rounded-md bg-amber/10 p-2 text-xs leading-5 text-ink/60">
            每日目标已修改，点击下方按钮后才会保存到云端。
          </p>
        ) : null}
        {goalMessage ? <p className={`mt-3 text-xs ${goalMessage.startsWith("已") ? "text-sage" : "text-coral"}`}>{goalMessage}</p> : null}
        <button
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white disabled:opacity-60"
          disabled={goalPending || !goalDirty}
          onClick={saveDailyGoal}
          type="button"
        >
          {goalPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          保存每日目标
        </button>

        {hasRealPlan && settings.activeSeries && progress ? (
          <div className="mt-4 rounded-md border border-mint/20 bg-mint/10 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sage">当前真实计划</p>
                <h3 className="mt-1 text-lg font-semibold text-ink">{settings.activeSeries.name}</h3>
                <p className="mt-1 text-sm text-ink/60">{formatStatus(settings.activeSeries.status)} · {formatSeriesType(settings.activeSeries.seriesType)}</p>
              </div>
              <button
                className="rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-ink"
                onClick={() => {
                  if (planEditorOpen && editingExistingPlan) {
                    setPlanEditorOpen(false);
                    setEditingExistingPlan(false);
                  } else {
                    editCurrentPlan();
                  }
                }}
                type="button"
              >
                {planEditorOpen && editingExistingPlan ? "收起" : "修改"}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <PreviewMetric label="当前牙套" value={`第 ${progress.currentTrayNumber} / ${progress.totalTrays ?? "?"} 副`} />
              <PreviewMetric label="当前第几天" value={progress.currentTrayDay ? `第 ${progress.currentTrayDay} 天` : "暂停中"} />
              <PreviewMetric label="下次换期" value={progress.nextChangeDate ?? "按医生安排"} />
              <PreviewMetric label="剩余副数" value={progress.traysRemaining === null ? "未知" : `${progress.traysRemaining} 副`} />
              <PreviewMetric label="全程副数" value={progress.overallTotalTrays ? `${progress.overallTotalTrays} 副` : "未知"} />
              <PreviewMetric label="治疗总周期" value={progress.overallTreatmentDays ? `${progress.overallTreatmentDays} 天` : "未知"} />
            </div>
            <div className="mt-4 rounded-md border border-amber/20 bg-white/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-ink">异常处理</h3>
                  <p className="mt-1 text-xs leading-5 text-ink/60">
                    记录延长、暂停、丢失损坏或不贴合等情况。这里只管理日程和记录，不提供医疗判断。
                  </p>
                </div>
                <button
                  className="shrink-0 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white"
                  onClick={() => setExceptionOpen((open) => !open)}
                  type="button"
                >
                  {exceptionOpen ? "收起" : "处理"}
                </button>
              </div>
              {exceptionOpen ? (
                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-ink/70" htmlFor="exception-type">
                    异常类型
                    <select
                      className="mt-2 min-h-12 w-full rounded-md border border-ink/10 bg-paper px-3 text-ink outline-none focus:border-mint"
                      id="exception-type"
                      onChange={(event) => setExceptionType(event.target.value as TreatmentExceptionType)}
                      value={exceptionType}
                    >
                      {exceptionOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <p className="rounded-md bg-mist/60 p-3 text-xs leading-5 text-ink/60">
                    {exceptionOptions.find((option) => option.value === exceptionType)?.helper}
                  </p>
                  <DateField
                    label="发生日期"
                    value={exceptionDate}
                    onChange={(value) => setExceptionDate(value || getClientDateKey())}
                  />
                  {isExtensionException(exceptionType) ? (
                    <NumberPickerField
                      label="延长天数"
                      onOpen={() => setNumberPicker({
                        title: exceptionType === "late_change" ? "延迟换期" : "当前副延戴",
                        helper: "只在医生要求多戴当前副时使用。",
                        value: exceptionDays,
                        options: rangeOptions(1, 30),
                        formatValue: (value) => `${value} 天`,
                        onSelect: setExceptionDays
                      })}
                      value={`${exceptionDays} 天`}
                    />
                  ) : null}
                  <label className="block text-sm font-medium text-ink/70" htmlFor="exception-note">
                    备注
                    <textarea
                      className="mt-2 min-h-20 w-full resize-none rounded-md border border-ink/10 bg-paper px-3 py-2 text-ink outline-none focus:border-mint"
                      id="exception-note"
                      onChange={(event) => setExceptionNote(event.target.value)}
                      placeholder="例如：医生要求第 8 副多戴 3 天；第 10 副不贴合，已联系诊所。"
                      value={exceptionNote}
                    />
                  </label>
                  <p className="rounded-md border border-amber/20 bg-mist/50 p-3 text-xs leading-5 text-ink/60">
                    牙套不贴合、疼痛、损坏、丢失或是否换下一副，请联系牙医/正畸医生；Loo牙只记录和调整日程。
                  </p>
                  <button
                    className="min-h-11 w-full rounded-md bg-ink px-4 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={exceptionPending}
                    onClick={saveException}
                    type="button"
                  >
                    {exceptionPending ? "保存中..." : "保存异常记录"}
                  </button>
                </div>
              ) : null}
              {exceptionMessage ? <p className={`mt-3 text-xs ${exceptionMessage.startsWith("已") ? "text-sage" : "text-coral"}`}>{exceptionMessage}</p> : null}
              {settings.exceptionEvents.length ? (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold tracking-[0.16em] text-ink/45">最近记录</p>
                  {settings.exceptionEvents.map((event) => (
                    <div className="rounded-md bg-mist/60 p-2 text-xs leading-5 text-ink/60" key={event.id}>
                      <span className="font-semibold text-ink">{formatExceptionType(event.eventType)}</span>
                      <span> · {event.eventDate}</span>
                      <span> · {formatExceptionStatus(event.status)}</span>
                      {event.extensionDays ? <span> · 延长 {event.extensionDays} 天</span> : null}
                      {event.scheduleAdjusted ? <span> · 已调整日程</span> : <span> · 仅记录</span>}
                      {event.note ? <p className="mt-1">{event.note}</p> : null}
                      {event.status === "active" ? (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            className="min-h-9 rounded-md bg-mint px-3 text-xs font-semibold text-white disabled:opacity-60"
                            disabled={exceptionActionPendingId === event.id}
                            onClick={() => updateException(event.id, "resolve")}
                            type="button"
                          >
                            标记已解决
                          </button>
                          <button
                            className="min-h-9 rounded-md border border-ink/10 px-3 text-xs font-semibold text-ink disabled:opacity-60"
                            disabled={exceptionActionPendingId === event.id}
                            onClick={() => updateException(event.id, "cancel")}
                            type="button"
                          >
                            取消记录
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-dashed border-amber/40 bg-mist/50 p-3">
            <h3 className="font-semibold text-ink">还没有真实牙套计划</h3>
            <p className="mt-1 text-sm leading-6 text-ink/60">
              你可以从第 1 副开始创建新计划，也可以导入已经佩戴了一段时间的计划。确认保存前，页面不会把默认值当成你的真实进度。
            </p>
          </div>
        )}

        {hasRealPlan ? (
          <div className="mt-4 space-y-3">
            {!planEditorOpen ? (
              <button
                className="min-h-12 w-full rounded-md bg-ink px-4 text-sm font-semibold text-white"
                onClick={editCurrentPlan}
                type="button"
              >
                修改当前计划
              </button>
            ) : null}
            <div className="rounded-md border border-amber/20 bg-mist/40 p-3">
              <p className="text-xs leading-5 text-ink/60">
                重新导入会替换当前 active 计划，只适合医生重新给了完整新计划、或你确认要重置进度时使用。
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className="min-h-11 rounded-md border border-ink/10 px-3 text-xs font-semibold text-ink"
                  onClick={() => armPlanReset("new")}
                  type="button"
                >
                  重置为新计划
                </button>
                <button
                  className="min-h-11 rounded-md border border-ink/10 px-3 text-xs font-semibold text-ink"
                  onClick={() => armPlanReset("import")}
                  type="button"
                >
                  重新导入计划
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              className={`min-h-12 rounded-md border px-3 text-sm font-semibold ${planSetupMode === "new" ? "border-ink bg-ink text-white" : "border-ink/10 text-ink"}`}
              onClick={() => choosePlanSetupMode("new")}
              type="button"
            >
              开始新计划
            </button>
            <button
              className={`min-h-12 rounded-md border px-3 text-sm font-semibold ${planSetupMode === "import" ? "border-ink bg-ink text-white" : "border-ink/10 text-ink"}`}
              onClick={() => choosePlanSetupMode("import")}
              type="button"
            >
              导入已进行计划
            </button>
          </div>
        )}

        {showPlanEditor ? (
          <>
            <div className="mt-4 rounded-md bg-mist/60 p-3 text-xs leading-5 text-ink/60">
              <p className="font-semibold text-ink">{planEditorTitle}</p>
              <p className="mt-1">
                {editingExistingPlan
                  ? "这里会修改当前计划本身，并重新生成当前计划的日程，不会创建新的计划记录。"
                  : isNewPlanMode
                    ? "新计划适合还没开始或准备从第 1 副开始追踪的情况。填写医生给你的总副数、每副佩戴天数和计划开始日，系统会生成后续日程。"
                    : "导入已进行计划适合已经佩戴了一段时间的情况。填写当前第几副和当前副开始日期；如果只记得下次换牙套日期，系统会反推当前副开始日。这不是每周都要重填。"}
              </p>
              {hasRealPlan && !editingExistingPlan ? (
                <p className="mt-2 font-semibold text-amber">这是重置操作，会替换当前 active 计划。请先生成预览并确认无误。</p>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="col-span-2 block text-sm font-medium text-ink/70" htmlFor="import-status">
                当前状态
                <select
                  className="mt-2 min-h-12 w-full rounded-md border border-ink/10 bg-paper px-3 text-ink outline-none focus:border-mint"
                  id="import-status"
                  onChange={(event) => {
                    const status = event.target.value as TreatmentStatus;
                    updateImportDraft({
                      ...importDraft,
                      status,
                      seriesType: status === "retainer" ? "retainer" : status === "holding" ? "holding" : importDraft.seriesType
                    });
                  }}
                  value={importDraft.status}
                >
                  <option value="not_started">尚未开始</option>
                  <option value="active">正在佩戴</option>
                  <option value="holding">保持/被动佩戴</option>
                  <option value="waiting_refinement">等待精修</option>
                  <option value="retainer">保持器阶段</option>
                </select>
              </label>

              <label className="col-span-2 block text-sm font-medium text-ink/70" htmlFor="import-series-name">
                阶段名称
                <input
                  className="mt-2 min-h-12 w-full rounded-md border border-ink/10 bg-paper px-3 text-ink outline-none focus:border-mint"
                  id="import-series-name"
                  onChange={(event) => updateImportDraft({ ...importDraft, name: event.target.value })}
                  value={importDraft.name}
                />
              </label>

              <label className="block text-sm font-medium text-ink/70" htmlFor="import-series-type">
                阶段类型
                <select
                  className="mt-2 min-h-12 w-full rounded-md border border-ink/10 bg-paper px-3 text-ink outline-none focus:border-mint"
                  id="import-series-type"
                  onChange={(event) => updateImportDraft({ ...importDraft, seriesType: event.target.value as TreatmentSeriesType })}
                  value={importDraft.seriesType}
                >
                  <option value="active">主动移动</option>
                  <option value="refinement">精修</option>
                  <option value="holding">保持/等待</option>
                  <option value="retainer">保持器</option>
                </select>
              </label>

              <ImportNumberPickerField
                label={isNewPlanMode ? "起始第几副" : "当前第几副"}
                onOpen={() => setNumberPicker({
                  title: isNewPlanMode ? "起始第几副" : "当前第几副",
                  value: importDraft.currentTrayNumber,
                  options: rangeOptions(1, Math.max(80, importDraft.totalTrays)),
                  formatValue: (value) => `第 ${value} 副`,
                  onSelect: (value) => updateImportDraft({ ...importDraft, currentTrayNumber: value })
                })}
                value={`第 ${importDraft.currentTrayNumber} 副`}
              />
              <ImportNumberPickerField
                helper="例如这一盒/这一阶段共有 20 副；未来精修可之后再加。"
                label="当前阶段总副数"
                onOpen={() => setNumberPicker({
                  title: "当前阶段总副数",
                  helper: "不能小于当前第几副。",
                  value: importDraft.totalTrays,
                  options: rangeOptions(Math.max(1, importDraft.currentTrayNumber), 100),
                  formatValue: (value) => `${value} 副`,
                  onSelect: (value) => updateImportDraft({ ...importDraft, totalTrays: value, overallTotalTrays: Math.max(importDraft.overallTotalTrays ?? value, value) })
                })}
                value={`${importDraft.totalTrays} 副`}
              />
              <ImportNumberPickerField
                helper="如果医生给了整体副数就填；不知道可先等于当前阶段。"
                label="全程预估总副数"
                onOpen={() => setNumberPicker({
                  title: "全程预估总副数",
                  helper: "不能小于当前第几副。",
                  value: importDraft.overallTotalTrays ?? importDraft.totalTrays,
                  options: rangeOptions(Math.max(1, importDraft.currentTrayNumber), 120),
                  formatValue: (value) => `${value} 副`,
                  onSelect: (value) => updateImportDraft({ ...importDraft, overallTotalTrays: value })
                })}
                value={`${importDraft.overallTotalTrays ?? importDraft.totalTrays} 副`}
              />
              <ImportNumberPickerField
                helper="可选。比如 20 副 x 7 天 = 140 天。"
                label="治疗总周期天数"
                onOpen={() => setNumberPicker({
                  title: "治疗总周期天数",
                  value: importDraft.overallTreatmentDays ?? importDraft.totalTrays * importDraft.trayIntervalDays,
                  options: rangeOptions(7, 900, 7),
                  formatValue: (value) => `${value} 天`,
                  onSelect: (value) => updateImportDraft({ ...importDraft, overallTreatmentDays: value })
                })}
                value={`${importDraft.overallTreatmentDays ?? importDraft.totalTrays * importDraft.trayIntervalDays} 天`}
              />
              <ImportNumberPickerField
                helper="医生要求的换副周期，常见 7/10/14 天。"
                label="每副佩戴天数"
                onOpen={() => setNumberPicker({
                  title: "每副佩戴天数",
                  value: importDraft.trayIntervalDays,
                  options: rangeOptions(1, 30),
                  formatValue: (value) => `${value} 天`,
                  onSelect: (value) => updateImportSchedule({ trayIntervalDays: value, overallTreatmentDays: (importDraft.overallTotalTrays ?? importDraft.totalTrays) * value })
                })}
                value={`${importDraft.trayIntervalDays} 天`}
              />
              <ImportNumberPickerField
                label="每日目标"
                onOpen={() => setNumberPicker({
                  title: "每日目标",
                  value: importDraft.dailyGoalMinutes,
                  options: minuteOptions(),
                  formatValue: formatMinutes,
                  onSelect: (value) => updateImportDraft({ ...importDraft, dailyGoalMinutes: value })
                })}
                value={formatMinutes(importDraft.dailyGoalMinutes)}
              />

              <p className="col-span-2 rounded-md bg-mist/60 p-3 text-xs leading-5 text-ink/60">
                日期只用于首次生成日程：优先填“{isNewPlanMode ? "计划开始日期" : "当前副开始日期"}”。之后每周/每期换牙套由系统按每副天数自动计算，不需要重复填写。
              </p>

              <DateField
                label={isNewPlanMode ? "计划开始日期" : "当前副开始日期"}
                helper={isNewPlanMode ? "第 1 副计划从哪天开始戴。" : "推荐填写：这副牙套从哪天开始戴。"}
                value={importDraft.currentTrayStartDate ?? ""}
                onChange={(value) => updateImportSchedule({ currentTrayStartDate: value || undefined })}
              />
              <DateField
                label="下次计划换期"
                helper={isNewPlanMode ? "会根据计划开始日 + 每副天数自动填。" : "会根据当前副开始日 + 每副天数自动填；只记得下次换期时可手动覆盖。"}
                value={importDraft.nextChangeDate ?? ""}
                onChange={(value) => updateImportSchedule({ nextChangeDate: value || undefined })}
              />
              <DateField
                label="整体治疗开始日"
                helper="可选。用于估算全程进度；不知道可不填。"
                value={importDraft.startDate ?? ""}
                onChange={(value) => updateImportDraft({ ...importDraft, startDate: value || undefined })}
              />
              <DateField
                label="下次复诊日期"
                value={importDraft.appointmentDate ?? ""}
                onChange={(value) => updateImportDraft({ ...importDraft, appointmentDate: value || undefined })}
              />

              <label className="col-span-2 block text-sm font-medium text-ink/70" htmlFor="clinician-notes">
                医嘱备注
                <textarea
                  className="mt-2 min-h-24 w-full resize-none rounded-md border border-ink/10 bg-paper px-3 py-2 text-ink outline-none focus:border-mint"
                  id="clinician-notes"
                  onChange={(event) => updateImportDraft({ ...importDraft, clinicianNotes: event.target.value })}
                  placeholder="例如：医生要求每副佩戴10天、下一次复诊时间、某一副需要多戴等。"
                  value={importDraft.clinicianNotes ?? ""}
                />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                className="flex min-h-12 items-center justify-center rounded-md border border-ink/10 px-4 text-sm font-semibold text-ink disabled:opacity-60"
                disabled={importPending}
                onClick={previewImport}
                type="button"
              >
                生成预览
              </button>
              <button
                className="flex min-h-12 items-center justify-center rounded-md bg-ink px-4 text-sm font-semibold text-white disabled:opacity-60"
                disabled={importPending || !importPreview || (hasRealPlan && !editingExistingPlan && !resetConfirmArmed)}
                onClick={savePlan}
                type="button"
              >
                {importPending
                  ? "处理中..."
                  : hasRealPlan && editingExistingPlan
                    ? "确认修改当前计划"
                    : hasRealPlan
                      ? resetConfirmArmed ? "确认重置计划" : "需先选择重置"
                      : "确认保存计划"}
              </button>
            </div>

            {importPreview ? <ImportPreviewCard preview={importPreview} /> : null}
          </>
        ) : null}
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">提醒偏好</h2>
        <p className="mt-2 text-sm leading-6 text-ink/60">
          提醒计时从你手动点击“我取下牙套了”开始；系统不会自动判断进食。
        </p>
        <label className="mt-4 flex items-center justify-between gap-3 text-sm text-ink">
          <span>摘下后提醒戴回</span>
          <input
            checked={settings.reminderSettings.enableMealReminder}
            className="h-5 w-5 accent-mint"
            onChange={(event) => {
              setSettings({
                ...settings,
                reminderSettings: {
                  ...settings.reminderSettings,
                  enableMealReminder: event.target.checked
                }
              });
              setReminderDirty(true);
              setReminderMessage(null);
            }}
            type="checkbox"
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-ink/70" htmlFor="mealReminderMinutes">
          取下多久后提醒
        </label>
        <select
          className="mt-2 min-h-12 w-full rounded-md border border-ink/10 bg-paper px-3 text-ink outline-none focus:border-mint"
          id="mealReminderMinutes"
          onChange={(event) => {
            setSettings({
              ...settings,
              reminderSettings: {
                ...settings.reminderSettings,
                mealReminderMinutes: Number(event.target.value)
              }
            });
            setReminderDirty(true);
            setReminderMessage(null);
          }}
          value={settings.reminderSettings.mealReminderMinutes}
        >
          {mealReminderMinuteOptions.map((minutes) => (
            <option key={minutes} value={minutes}>{minutes} 分钟</option>
          ))}
        </select>
        <p className="mt-2 text-xs leading-5 text-ink/50">
          这个提醒基于你手动点击“我取下牙套了”的时间开始计时，不会自动识别吃饭。
        </p>
        <div className="mt-4 rounded-md bg-mist/60 p-3 text-sm leading-6 text-ink/65">
          <p className="font-semibold text-ink">当前规则</p>
          <p className="mt-1">
            {settings.reminderSettings.enableMealReminder
              ? `摘下牙套 ${settings.reminderSettings.mealReminderMinutes} 分钟后提醒戴回。戴回后，本次提醒会自动取消。`
              : "摘下后提醒尚未开启。开启后仍需在当前设备允许推送。"}
          </p>
        </div>
        {reminderDirty ? (
          <p className="mt-3 rounded-md bg-amber/10 p-2 text-xs leading-5 text-ink/60">
            提醒偏好已修改，点击下方按钮后才会保存到云端。
          </p>
        ) : null}
        {reminderMessage ? <p className={`mt-3 text-xs ${reminderMessage.startsWith("已") ? "text-sage" : "text-coral"}`}>{reminderMessage}</p> : null}
        <button
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white disabled:opacity-60"
          disabled={reminderPending || !reminderDirty}
          onClick={saveReminderPreferences}
          type="button"
        >
          {reminderPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          保存提醒偏好
        </button>
        <details className="mt-4 rounded-md border border-ink/10 bg-paper p-3">
          <summary className="cursor-pointer text-sm font-semibold text-ink">当前设备推送与工作原理</summary>
          <div className="mt-4 space-y-3">
            <PushNotificationCard />
            <div className="space-y-3 text-sm leading-6 text-ink/65">
              <HowItWorksRow
                icon={<Timer className="h-4 w-4" />}
                title="从手动摘下开始计时"
                body="只有你在今日页点击“我取下牙套了”，才会生成本次戴回提醒。"
              />
              <HowItWorksRow
                icon={<Bell className="h-4 w-4" />}
                title="到期才发送通知"
                body="后台定时检查是否有到期任务。没有到期任务时不会发通知，也不会重复通知。"
              />
              <HowItWorksRow
                icon={<Cloud className="h-4 w-4" />}
                title="戴回后自动取消"
                body="如果你已经点击“我戴回牙套了”，这次摘下对应的提醒会取消。"
              />
            </div>
          </div>
        </details>
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">时区与今日边界</h2>
        <p className="mt-2 text-sm leading-6 text-ink/60">
          Today、趋势、日历和导出会按这里的时区切分“今天”。当前手机检测时区：{detectedTimeZone}。
        </p>
        <label className="mt-4 block text-sm font-medium text-ink/70" htmlFor="time-zone">
          当前使用时区
          <select
            className="mt-2 min-h-12 w-full rounded-md border border-ink/10 bg-paper px-3 text-ink outline-none focus:border-mint"
            id="time-zone"
            onChange={(event) => {
              changeTimeZone(event.target.value).catch((err: Error) => setError(err.message));
            }}
            value={timeZone}
          >
            {timeZoneOptions.includes(timeZone) ? null : <option value={timeZone}>{timeZone}</option>}
            {timeZoneOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-mist/60 p-3 text-xs text-ink/60">
          <span>{manualTimeZone ? "已手动指定时区。" : "正在使用手机浏览器自动检测时区。"}</span>
          <button
            className="shrink-0 rounded-full border border-ink/10 px-3 py-1 font-semibold text-ink"
            onClick={() => {
              resetToDetectedTimeZone().catch((err: Error) => setError(err.message));
            }}
            type="button"
          >
            使用自动检测
          </button>
        </div>
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">数据导出</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <a className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-ink/10 text-sm font-semibold text-ink" href={`/api/export/json?timeZone=${exportTimeZone}`}>
            <Download className="h-4 w-4" />
            JSON
          </a>
          <a className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-ink/10 text-sm font-semibold text-ink" href={`/api/export/csv?timeZone=${exportTimeZone}`}>
            <Download className="h-4 w-4" />
            CSV
          </a>
        </div>
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">账户</h2>
        <p className="mt-2 text-sm leading-6 text-ink/60">
          退出登录会清除当前设备的登录状态，不会删除你的牙套计划或佩戴记录。
        </p>
        <div className="mt-4">
          <LogoutButton variant="wide" />
        </div>
      </section>

      <NumberPickerSheet picker={numberPicker} onClose={() => setNumberPicker(null)} />
    </div>
  );
}

function NumberPickerField(props: {
  label: string;
  helper?: string;
  value: string;
  className?: string;
  onOpen: () => void;
}) {
  return (
    <div className={`block text-sm font-medium text-ink/70 ${props.className ?? ""}`}>
      {props.label}
      <button
        className="mt-2 flex min-h-12 w-full items-center justify-between rounded-md border border-ink/10 bg-paper px-3 text-left text-ink outline-none transition focus:border-mint"
        onClick={props.onOpen}
        type="button"
      >
        <span>{props.value}</span>
        <span className="text-xs text-ink/40">选择</span>
      </button>
      {props.helper ? <span className="mt-1 block text-xs leading-5 text-ink/50">{props.helper}</span> : null}
    </div>
  );
}

function ImportNumberPickerField(props: {
  label: string;
  helper?: string;
  value: string;
  onOpen: () => void;
}) {
  return <NumberPickerField {...props} />;
}

function NumberPickerSheet(props: {
  picker: NumberPickerState;
  onClose: () => void;
}) {
  if (!props.picker) {
    return null;
  }

  const { picker } = props;

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-ink/30 px-3 pb-3" role="dialog" aria-modal="true">
      <button className="absolute inset-0 cursor-default" onClick={props.onClose} type="button" aria-label="关闭选择器" />
      <div className="safe-bottom relative z-10 mx-auto w-full max-w-md rounded-t-3xl border border-ink/10 bg-white p-4 shadow-[0_-20px_60px_rgba(91,47,55,0.18)]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-ink">{picker.title}</h3>
            {picker.helper ? <p className="mt-1 text-sm leading-5 text-ink/60">{picker.helper}</p> : null}
          </div>
          <button className="rounded-full px-3 py-1 text-sm font-semibold text-ink/60" onClick={props.onClose} type="button">
            取消
          </button>
        </div>
        <div className="mt-4 max-h-[45vh] snap-y overflow-y-auto rounded-md border border-ink/10 bg-paper">
          {picker.options.map((option) => {
            const active = option === picker.value;

            return (
              <button
                className={`flex min-h-12 w-full snap-center items-center justify-center border-b border-ink/5 px-4 text-base font-semibold last:border-b-0 ${
                  active ? "bg-mint/15 text-ink" : "text-ink/70"
                }`}
                key={option}
                onClick={() => {
                  picker.onSelect(option);
                  props.onClose();
                }}
                type="button"
              >
                {picker.formatValue ? picker.formatValue(option) : option}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DateField(props: {
  label: string;
  helper?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `date-${props.label.length}`;

  return (
    <label className="block text-sm font-medium text-ink/70" htmlFor={id}>
      {props.label}
      <input
        className="mt-2 min-h-12 w-full rounded-md border border-ink/10 bg-paper px-3 text-ink outline-none focus:border-mint"
        id={id}
        onChange={(event) => props.onChange(event.target.value)}
        type="date"
        value={props.value}
      />
      {props.helper ? <span className="mt-1 block text-xs leading-5 text-ink/50">{props.helper}</span> : null}
    </label>
  );
}

function ImportPreviewCard({ preview }: { preview: TreatmentPlanImportPreview }) {
  const firstTrays = preview.trays.slice(Math.max(0, preview.series.currentTrayNumber - 2), preview.series.currentTrayNumber + 3);

  return (
    <div className="mt-4 rounded-md border border-amber/20 bg-mist/50 p-3">
      <h3 className="font-semibold text-ink">计划预览</h3>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <PreviewMetric label="当前牙套" value={`第 ${preview.progress.currentTrayNumber} / ${preview.progress.totalTrays ?? "?"} 副`} />
        <PreviewMetric label="全程副数" value={preview.progress.overallTotalTrays ? `${preview.progress.overallTotalTrays} 副` : "未知"} />
        <PreviewMetric label="总周期" value={preview.progress.overallTreatmentDays ? `${preview.progress.overallTreatmentDays} 天` : "未知"} />
        <PreviewMetric label="每副周期" value={`${preview.progress.trayIntervalDays} 天`} />
        <PreviewMetric label="下次换期" value={preview.progress.nextChangeDate ?? "暂停/待医生确认"} />
        <PreviewMetric label="预计结束" value={preview.progress.estimatedSeriesEndDate ?? "未知"} />
        <PreviewMetric label="剩余副数" value={preview.progress.traysRemaining === null ? "未知" : `${preview.progress.traysRemaining} 副`} />
        <PreviewMetric label="每日目标" value={formatMinutes(preview.series.dailyGoalMinutes)} />
      </div>

      <div className="mt-3 space-y-2">
        {firstTrays.map((tray) => (
          <div className="flex items-center justify-between rounded-md bg-white/80 px-3 py-2 text-sm" key={tray.trayNumber}>
            <span className="font-medium text-ink">第 {tray.trayNumber} 副</span>
            <span className="text-ink/60">{tray.plannedStartDate} 至 {tray.plannedEndDate}</span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs leading-5 text-ink/60">{preview.safetyNote}</p>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/80 p-2">
      <p className="text-xs text-ink/50">{label}</p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  );
}

function HowItWorksRow(props: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-sage">
        {props.icon}
      </div>
      <div>
        <p className="font-medium text-ink">{props.title}</p>
        <p className="mt-0.5">{props.body}</p>
      </div>
    </div>
  );
}

function formatStatus(status: TreatmentStatus) {
  const labels: Record<TreatmentStatus, string> = {
    not_started: "尚未开始",
    active: "正在佩戴",
    holding: "保持/被动佩戴",
    waiting_refinement: "等待精修",
    retainer: "保持器阶段"
  };

  return labels[status];
}

function formatSeriesType(seriesType: TreatmentSeriesType) {
  const labels: Record<TreatmentSeriesType, string> = {
    active: "主动移动",
    refinement: "精修",
    holding: "保持/等待",
    retainer: "保持器"
  };

  return labels[seriesType];
}

function formatExceptionType(type: TreatmentExceptionType) {
  const labels: Record<TreatmentExceptionType, string> = {
    late_change: "延迟换期",
    tray_extension: "当前副延戴",
    extend_current_tray: "延长当前副",
    poor_fit: "牙套不贴合",
    lost_tray: "牙套丢失",
    broken_tray: "牙套损坏",
    lost_or_broken: "丢失/损坏",
    waiting_refinement: "等待精修",
    waiting_rescan: "等待复扫",
    waiting_retainer: "等待保持器"
  };

  return labels[type];
}

function formatExceptionStatus(status: TreatmentExceptionEvent["status"]) {
  const labels: Record<TreatmentExceptionEvent["status"], string> = {
    active: "处理中",
    resolved: "已解决",
    cancelled: "已取消"
  };

  return labels[status];
}

function isExtensionException(type: TreatmentExceptionType) {
  return type === "late_change" || type === "tray_extension" || type === "extend_current_tray";
}

function normalizeImportDraft(draft: ImportState): TreatmentPlanImportInput {
  return {
    ...draft,
    name: draft.name.trim(),
    overallTotalTrays: draft.overallTotalTrays || undefined,
    overallTreatmentDays: draft.overallTreatmentDays || undefined,
    currentTrayStartDate: draft.currentTrayStartDate || undefined,
    nextChangeDate: draft.nextChangeDate || undefined,
    startDate: draft.startDate || undefined,
    appointmentDate: draft.appointmentDate || undefined,
    clinicianNotes: draft.clinicianNotes?.trim() || undefined
  };
}

function rangeOptions(min: number, max: number, step = 1) {
  const options: number[] = [];

  for (let value = min; value <= max; value += step) {
    options.push(value);
  }

  return options;
}

function minuteOptions() {
  return [
    ...rangeOptions(60, 1140, 60),
    ...rangeOptions(1200, 1380, 15),
    1440
  ];
}

function addDaysKey(dateKey: string, days: number) {
  const date = parseISO(dateKey);

  return isValid(date) ? format(addDays(date, days), "yyyy-MM-dd") : undefined;
}

function subDaysKey(dateKey: string, days: number) {
  const date = parseISO(dateKey);

  return isValid(date) ? format(subDays(date, days), "yyyy-MM-dd") : undefined;
}
