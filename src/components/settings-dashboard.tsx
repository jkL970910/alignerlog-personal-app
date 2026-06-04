"use client";

import { addDays, format, isValid, parseISO, subDays } from "date-fns";
import { FormEvent, useEffect, useState } from "react";
import { Download, Loader2, Save, Sparkles } from "lucide-react";

import type { PlanProgress, ReminderSettings, TreatmentPlan, TreatmentPlanImportInput, TreatmentPlanImportPreview, TreatmentSeries, TreatmentSeriesType, TreatmentStatus } from "@/lib/types";
import { formatMinutes } from "@/lib/format";

import { SetupWarning } from "./setup-warning";

type SettingsPayload = {
  treatmentPlan: TreatmentPlan;
  reminderSettings: ReminderSettings;
  activeSeries: TreatmentSeries | null;
  planProgress: PlanProgress | null;
};

type ImportState = TreatmentPlanImportInput;
type PlanSetupMode = "new" | "import";

function createDefaultImport(mode: PlanSetupMode = "import", dailyGoalMinutes = 1320): ImportState {
  const today = new Date().toISOString().slice(0, 10);
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
  const [pending, setPending] = useState(false);
  const [importDraft, setImportDraft] = useState<ImportState>(() => createDefaultImport());
  const [importPreview, setImportPreview] = useState<TreatmentPlanImportPreview | null>(null);
  const [importPending, setImportPending] = useState(false);
  const [importDraftInitialized, setImportDraftInitialized] = useState(false);
  const [planSetupMode, setPlanSetupMode] = useState<PlanSetupMode | null>(null);
  const [planEditorOpen, setPlanEditorOpen] = useState(false);
  const [editingExistingPlan, setEditingExistingPlan] = useState(false);
  const [resetConfirmArmed, setResetConfirmArmed] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then(async (response) => {
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "无法载入设置。");
        }

        setSettings(payload);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

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

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!settings) {
      return;
    }

    setPending(true);

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "无法保存设置。");
      }

      setSettings(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法保存设置。");
    } finally {
      setPending(false);
    }
  }

  async function previewImport() {
    setImportPending(true);
    setError(null);

    try {
      const response = await fetch("/api/treatment-plan/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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

  return (
    <form className="space-y-4" onSubmit={save}>
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

        <label className="mt-4 block text-sm font-medium text-ink/70" htmlFor="dailyGoalMinutes">
          每日佩戴目标
          <input
            className="mt-2 min-h-12 w-full rounded-md border border-ink/10 bg-paper px-3 text-ink outline-none focus:border-mint"
            id="dailyGoalMinutes"
            inputMode="numeric"
            min={60}
            onChange={(event) => setSettings({
              ...settings,
              treatmentPlan: {
                ...settings.treatmentPlan,
                dailyGoalMinutes: Number(event.target.value)
              }
            })}
            type="number"
            value={settings.treatmentPlan.dailyGoalMinutes}
          />
          <span className="mt-1 block text-xs leading-5 text-ink/50">默认 22 小时，可按医生要求调整。</span>
        </label>

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

              <ImportField label={isNewPlanMode ? "起始第几副" : "当前第几副"} min={1} value={importDraft.currentTrayNumber} onChange={(value) => updateImportDraft({ ...importDraft, currentTrayNumber: value })} />
              <ImportField label="当前阶段总副数" helper="例如这一盒/这一阶段共有 20 副；未来精修可之后再加。" min={1} value={importDraft.totalTrays} onChange={(value) => updateImportDraft({ ...importDraft, totalTrays: value, overallTotalTrays: Math.max(importDraft.overallTotalTrays ?? value, value) })} />
              <ImportField label="全程预估总副数" helper="如果医生给了整体副数就填；不知道可先等于当前阶段。" min={1} value={importDraft.overallTotalTrays ?? importDraft.totalTrays} onChange={(value) => updateImportDraft({ ...importDraft, overallTotalTrays: value })} />
              <ImportField label="治疗总周期天数" helper="可选。比如 20 副 x 7 天 = 140 天。" min={1} value={importDraft.overallTreatmentDays ?? importDraft.totalTrays * importDraft.trayIntervalDays} onChange={(value) => updateImportDraft({ ...importDraft, overallTreatmentDays: value })} />
              <ImportField label="每副佩戴天数" helper="医生要求的换副周期，常见 7/10/14 天。" min={1} value={importDraft.trayIntervalDays} onChange={(value) => updateImportSchedule({ trayIntervalDays: value, overallTreatmentDays: (importDraft.overallTotalTrays ?? importDraft.totalTrays) * value })} />
              <ImportField label="每日目标分钟" min={60} value={importDraft.dailyGoalMinutes} onChange={(value) => updateImportDraft({ ...importDraft, dailyGoalMinutes: value })} />

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
        <label className="mt-4 flex items-center justify-between gap-3 text-sm text-ink">
          <span>进食后提醒</span>
          <input
            checked={settings.reminderSettings.enableMealReminder}
            className="h-5 w-5 accent-mint"
            onChange={(event) => setSettings({
              ...settings,
              reminderSettings: {
                ...settings.reminderSettings,
                enableMealReminder: event.target.checked
              }
            })}
            type="checkbox"
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-ink/70" htmlFor="mealReminderMinutes">
          取下多久后提醒
        </label>
        <select
          className="mt-2 min-h-12 w-full rounded-md border border-ink/10 bg-paper px-3 text-ink outline-none focus:border-mint"
          id="mealReminderMinutes"
          onChange={(event) => setSettings({
            ...settings,
            reminderSettings: {
              ...settings.reminderSettings,
              mealReminderMinutes: Number(event.target.value)
            }
          })}
          value={settings.reminderSettings.mealReminderMinutes}
        >
          {[30, 45, 60, 90].map((minutes) => (
            <option key={minutes} value={minutes}>{minutes} 分钟</option>
          ))}
        </select>
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">数据导出</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <a className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-ink/10 text-sm font-semibold text-ink" href="/api/export/json">
            <Download className="h-4 w-4" />
            JSON
          </a>
          <a className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-ink/10 text-sm font-semibold text-ink" href="/api/export/csv">
            <Download className="h-4 w-4" />
            CSV
          </a>
        </div>
      </section>

      <button
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-ink px-5 text-base font-semibold text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
        保存设置
      </button>
    </form>
  );
}

function ImportField(props: {
  label: string;
  helper?: string;
  value: number;
  min: number;
  onChange: (value: number) => void;
}) {
  const id = `import-${props.label.length}`;

  return (
    <label className="block text-sm font-medium text-ink/70" htmlFor={id}>
      {props.label}
      <input
        className="mt-2 min-h-12 w-full rounded-md border border-ink/10 bg-paper px-3 text-ink outline-none focus:border-mint"
        id={id}
        inputMode="numeric"
        min={props.min}
        onChange={(event) => props.onChange(Number(event.target.value))}
        type="number"
        value={props.value}
      />
      {props.helper ? <span className="mt-1 block text-xs leading-5 text-ink/50">{props.helper}</span> : null}
    </label>
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

function addDaysKey(dateKey: string, days: number) {
  const date = parseISO(dateKey);

  return isValid(date) ? format(addDays(date, days), "yyyy-MM-dd") : undefined;
}

function subDaysKey(dateKey: string, days: number) {
  const date = parseISO(dateKey);

  return isValid(date) ? format(subDays(date, days), "yyyy-MM-dd") : undefined;
}
