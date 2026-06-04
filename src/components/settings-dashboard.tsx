"use client";

import { addDays, format, isValid, parseISO, subDays } from "date-fns";
import { FormEvent, useEffect, useState } from "react";
import { Download, Loader2, Save, Sparkles } from "lucide-react";

import type { ReminderSettings, TreatmentPlan, TreatmentPlanImportInput, TreatmentPlanImportPreview, TreatmentSeriesType, TreatmentStatus } from "@/lib/types";
import { formatMinutes } from "@/lib/format";

import { SetupWarning } from "./setup-warning";

type SettingsPayload = {
  treatmentPlan: TreatmentPlan;
  reminderSettings: ReminderSettings;
};

type ImportState = TreatmentPlanImportInput;

const defaultImport: ImportState = {
  status: "active",
  seriesType: "active",
  name: "第一阶段",
  currentTrayNumber: 1,
  totalTrays: 20,
  overallTotalTrays: 20,
  overallTreatmentDays: 140,
  trayIntervalDays: 7,
  dailyGoalMinutes: 1320,
  currentTrayStartDate: new Date().toISOString().slice(0, 10),
  clinicianNotes: ""
};

export function SettingsDashboard() {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [importDraft, setImportDraft] = useState<ImportState>(defaultImport);
  const [importPreview, setImportPreview] = useState<TreatmentPlanImportPreview | null>(null);
  const [importPending, setImportPending] = useState(false);

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

  async function confirmImport() {
    setImportPending(true);
    setError(null);

    try {
      const response = await fetch("/api/treatment-plan/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "confirm", plan: normalizeImportDraft(importDraft) })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "无法保存牙套计划。");
      }

      setImportPreview(payload);
      setSettings(settings ? {
        ...settings,
        treatmentPlan: {
          ...settings.treatmentPlan,
          startDate: payload.series.startDate,
          currentTrayNumber: payload.series.currentTrayNumber,
          totalTrays: payload.series.totalTrays,
          daysPerTray: payload.series.trayIntervalDays,
          dailyGoalMinutes: payload.series.dailyGoalMinutes
        }
      } : settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法保存牙套计划。");
    } finally {
      setImportPending(false);
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

  return (
    <form className="space-y-4" onSubmit={save}>
      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">每日目标</h2>
        <label className="mt-4 block text-sm font-medium text-ink/70" htmlFor="dailyGoalMinutes">
          目标分钟数
        </label>
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
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">当前牙套计划</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field
            label="开始日期"
            type="date"
            value={settings.treatmentPlan.startDate}
            onChange={(value) => setSettings({
              ...settings,
              treatmentPlan: { ...settings.treatmentPlan, startDate: value }
            })}
          />
          <Field
            label="当前第几副"
            type="number"
            value={String(settings.treatmentPlan.currentTrayNumber)}
            onChange={(value) => setSettings({
              ...settings,
              treatmentPlan: { ...settings.treatmentPlan, currentTrayNumber: Number(value) }
            })}
          />
          <Field
            label="总副数"
            type="number"
            value={String(settings.treatmentPlan.totalTrays ?? "")}
            onChange={(value) => setSettings({
              ...settings,
              treatmentPlan: { ...settings.treatmentPlan, totalTrays: value ? Number(value) : null }
            })}
          />
          <Field
            label="每副天数"
            type="number"
            value={String(settings.treatmentPlan.daysPerTray)}
            onChange={(value) => setSettings({
              ...settings,
              treatmentPlan: { ...settings.treatmentPlan, daysPerTray: Number(value) }
            })}
          />
        </div>
      </section>

      <section className="rounded-md border border-amber/20 bg-white p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-mist text-amber">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink">导入既有牙套计划</h2>
            <p className="mt-1 text-sm leading-6 text-ink/60">
              这是一次性导入，不需要每周手动重填。填入当前副或下次换期作为锚点后，系统会按每副天数自动生成日程。
            </p>
          </div>
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

          <ImportField label="当前第几副" min={1} value={importDraft.currentTrayNumber} onChange={(value) => updateImportDraft({ ...importDraft, currentTrayNumber: value })} />
          <ImportField label="当前阶段总副数" helper="例如这一盒/这一阶段共有 20 副；未来精修可之后再加。" min={1} value={importDraft.totalTrays} onChange={(value) => updateImportDraft({ ...importDraft, totalTrays: value, overallTotalTrays: Math.max(importDraft.overallTotalTrays ?? value, value) })} />
          <ImportField label="全程预估总副数" helper="如果医生给了整体副数就填；不知道可先等于当前阶段。" min={1} value={importDraft.overallTotalTrays ?? importDraft.totalTrays} onChange={(value) => updateImportDraft({ ...importDraft, overallTotalTrays: value })} />
          <ImportField label="治疗总周期天数" helper="可选。比如 20 副 x 7 天 = 140 天。" min={1} value={importDraft.overallTreatmentDays ?? importDraft.totalTrays * importDraft.trayIntervalDays} onChange={(value) => updateImportDraft({ ...importDraft, overallTreatmentDays: value })} />
          <ImportField label="每副佩戴天数" helper="医生要求的换副周期，常见 7/10/14 天。" min={1} value={importDraft.trayIntervalDays} onChange={(value) => updateImportSchedule({ trayIntervalDays: value, overallTreatmentDays: (importDraft.overallTotalTrays ?? importDraft.totalTrays) * value })} />
          <ImportField label="每日目标分钟" min={60} value={importDraft.dailyGoalMinutes} onChange={(value) => updateImportDraft({ ...importDraft, dailyGoalMinutes: value })} />

          <p className="col-span-2 rounded-md bg-mist/60 p-3 text-xs leading-5 text-ink/60">
            计划锚点只用于导入时定位当前进度：优先填“当前副开始日期”。如果你只记得下次换牙套日期，也可以填下次换期，系统会反推当前副开始日。之后每周换期由系统自动计算。
          </p>

          <DateField
            label="当前副开始日期"
            helper="推荐填写：这副牙套从哪天开始戴。"
            value={importDraft.currentTrayStartDate ?? ""}
            onChange={(value) => updateImportSchedule({ currentTrayStartDate: value || undefined })}
          />
          <DateField
            label="下次计划换期"
            helper="会根据当前副开始日 + 每副天数自动填；也可手动覆盖。"
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
            disabled={importPending || !importPreview}
            onClick={confirmImport}
            type="button"
          >
            {importPending ? "处理中..." : "确认导入"}
          </button>
        </div>

        {importPreview ? <ImportPreviewCard preview={importPreview} /> : null}
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

function Field(props: {
  label: string;
  type: "date" | "number";
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `field-${props.label.length}-${props.type}`;

  return (
    <label className="block text-sm font-medium text-ink/70" htmlFor={id}>
      {props.label}
      <input
        className="mt-2 min-h-12 w-full rounded-md border border-ink/10 bg-paper px-3 text-ink outline-none focus:border-mint"
        id={id}
        inputMode={props.type === "number" ? "numeric" : undefined}
        onChange={(event) => props.onChange(event.target.value)}
        type={props.type}
        value={props.value}
      />
    </label>
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
