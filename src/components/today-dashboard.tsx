"use client";

import { useEffect, useState } from "react";
import { Clock, Loader2, ShieldCheck, Utensils } from "lucide-react";

import { formatMinutes, formatPercent } from "@/lib/format";
import { getClientDateKey, timeZoneHeaders } from "@/lib/client-time-zone";
import type { AppSnapshot } from "@/lib/types";

import { SetupWarning } from "./setup-warning";

type ApiState =
  | { status: "loading"; data?: never; error?: never }
  | { status: "ready"; data: AppSnapshot; error?: never }
  | { status: "error"; data?: never; error: string };

type ManualMode = "closed_session" | "forgot_take_off_open" | "forgot_put_back" | "wearing_baseline";

export function TodayDashboard() {
  const [state, setState] = useState<ApiState>({ status: "loading" });
  const [pending, setPending] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualMode, setManualMode] = useState<ManualMode>("closed_session");
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [manualPending, setManualPending] = useState(false);
  const [manualMessage, setManualMessage] = useState<string | null>(null);
  const [advancePending, setAdvancePending] = useState(false);
  const [advanceMessage, setAdvanceMessage] = useState<string | null>(null);
  const [appointmentExtendPending, setAppointmentExtendPending] = useState(false);

  async function load() {
    const response = await fetch("/api/snapshot", {
      headers: timeZoneHeaders()
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "无法载入今日佩戴数据。");
    }

    setState({ status: "ready", data: payload });
  }

  useEffect(() => {
    load().catch((error: Error) => setState({ status: "error", error: error.message }));
    const id = window.setInterval(() => {
      load().catch(() => undefined);
    }, 30000);

    return () => window.clearInterval(id);
  }, []);

  async function toggle() {
    if (state.status !== "ready") {
      return;
    }

    setPending(true);
    const action = state.data.wearState.isWearing ? "start" : "end";

    try {
      const response = await fetch("/api/wear/toggle", {
        method: "POST",
        headers: {
          ...timeZoneHeaders({
            "Content-Type": "application/json",
            "X-Loo-Source": "today-dashboard"
          })
        },
        body: JSON.stringify({ action, reason: "meal" })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "无法更新佩戴状态。");
      }

      setState({
        status: "ready",
        data: {
          ...state.data,
          wearState: payload.wearState,
          activeSession: payload.activeSession,
          todaySummary: payload.todaySummary
        }
      });
    } catch (error) {
      setState({ status: "error", error: error instanceof Error ? error.message : "无法更新佩戴状态。" });
    } finally {
      setPending(false);
    }
  }

  async function saveManualSession() {
    if (state.status !== "ready") {
      return;
    }

    setManualPending(true);
    setManualMessage(null);

    try {
      const response = await fetch("/api/wear/manual-session", {
        method: "POST",
        headers: {
          ...timeZoneHeaders({
            "Content-Type": "application/json",
            "X-Loo-Source": "today-manual-session"
          })
        },
        body: JSON.stringify({
          mode: manualMode,
          startLocal: manualStart,
          endLocal: manualMode === "closed_session" || manualMode === "forgot_put_back" ? manualEnd : undefined,
          reason: "other"
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "无法保存补记。");
      }

      setState({
        status: "ready",
        data: {
          ...state.data,
          wearState: payload.wearState,
          activeSession: payload.activeSession,
          todaySummary: payload.todaySummary
        }
      });
      setManualMessage(getManualSuccessText(manualMode));
      setManualStart("");
      setManualEnd("");
      setManualOpen(false);
    } catch (error) {
      setManualMessage(error instanceof Error ? error.message : "无法保存补记。");
    } finally {
      setManualPending(false);
    }
  }

  async function advanceTray() {
    if (state.status !== "ready") {
      return;
    }

    setAdvancePending(true);
    setAdvanceMessage(null);

    try {
      const response = await fetch("/api/treatment-plan/advance", {
        method: "POST",
        headers: timeZoneHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ confirmedDate: getClientDateKey() })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "无法确认换期。");
      }

      setState({
        status: "ready",
        data: {
          ...state.data,
          activeSeries: payload.series,
          planProgress: payload.progress,
          activeException: null,
          recentExceptions: []
        }
      });
      setAdvanceMessage(`已进入第 ${payload.series.currentTrayNumber} 副。`);
    } catch (error) {
      setAdvanceMessage(error instanceof Error ? error.message : "无法确认换期。");
    } finally {
      setAdvancePending(false);
    }
  }

  async function extendLastTrayToAppointment() {
    if (state.status !== "ready" || !state.data.appointmentExtensionSuggestion) {
      return;
    }

    const suggestion = state.data.appointmentExtensionSuggestion;
    setAppointmentExtendPending(true);
    setAdvanceMessage(null);

    try {
      const response = await fetch("/api/treatment-plan/exception", {
        method: "POST",
        headers: timeZoneHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          eventType: "tray_extension",
          eventDate: getClientDateKey(),
          extensionDays: suggestion.extensionDays,
          note: `默认延戴到复诊日 ${suggestion.appointmentDate}。`
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "无法延戴到复诊日。");
      }

      setState({
        status: "ready",
        data: {
          ...state.data,
          activeSeries: payload.series,
          planProgress: payload.progress,
          appointmentExtensionSuggestion: null,
          activeException: payload.event,
          recentExceptions: [payload.event, ...(state.data.recentExceptions ?? [])].slice(0, 3)
        }
      });
      setAdvanceMessage(`已将第 ${suggestion.trayNumber} 副延戴到 ${formatDateShort(suggestion.appointmentDate)}。`);
    } catch (error) {
      setAdvanceMessage(error instanceof Error ? error.message : "无法延戴到复诊日。");
    } finally {
      setAppointmentExtendPending(false);
    }
  }

  if (state.status === "loading") {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-md border border-ink/10 bg-white/75">
        <Loader2 className="h-6 w-6 animate-spin text-sage" />
      </div>
    );
  }

  if (state.status === "error") {
    return <SetupWarning message={state.error} />;
  }

  const { wearState, activeSession, todaySummary, treatmentPlan, activeSeries } = state.data;
  const planProgress = state.data.planProgress;
  const appointmentExtensionSuggestion = state.data.appointmentExtensionSuggestion ?? null;
  const activeException = state.data.activeException ?? null;
  const isTrayDue = Boolean(planProgress && planProgress.label === "on_track" && planProgress.daysUntilNextChange !== null && planProgress.daysUntilNextChange <= 0);
  const canAdvanceTray = Boolean(isTrayDue && planProgress?.totalTrays && planProgress.currentTrayNumber < planProgress.totalTrays);
  const isWearing = wearState.isWearing;
  const progress = todaySummary.hasData ? Math.min(100, (todaySummary.wearMinutes / treatmentPlan.dailyGoalMinutes) * 100) : 0;
  const activeOutMinutes = activeSession ? Math.max(0, Math.floor((Date.now() - new Date(activeSession.startAt).getTime()) / 60000)) : 0;
  const currentTrayPercent = planProgress ? getCurrentTrayProgressPercent(planProgress) : 0;
  const stagePercent = planProgress ? getStageProgressPercent(planProgress, currentTrayPercent) : 0;

  return (
    <div className="space-y-4">
      {planProgress ? (
        <section className="rounded-md border border-amber/20 bg-white/90 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.18em] text-sage">当前阶段计划</p>
              <p className="mt-1 text-sm text-ink/55">
                {formatSeriesType(activeSeries?.seriesType)} · 本阶段共 {planProgress.totalTrays ?? "?"} 副
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-ink">
                正在佩戴第 {planProgress.currentTrayNumber} 副
              </h2>
              <div className="mt-3 inline-flex items-center gap-3 rounded-md bg-mist px-3 py-2">
                <div>
                  <p className="text-xs text-ink/50">下次换期</p>
                  <p className="mt-0.5 font-semibold leading-tight text-ink">{formatDateShort(planProgress.nextChangeDate)}</p>
                </div>
                {planProgress.nextChangeDate ? <p className="text-xs text-ink/45">{formatWeekday(planProgress.nextChangeDate)}</p> : null}
              </div>
            </div>
            <DualProgressRings
              stagePercent={stagePercent}
              trayPercent={currentTrayPercent}
            />
          </div>
        </section>
      ) : null}

      {activeException ? (
        <section className="rounded-md border border-coral/25 bg-coral/10 p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-[0.18em] text-coral">当前异常</p>
          <h2 className="mt-2 text-lg font-semibold text-ink">{formatExceptionType(activeException.eventType)}</h2>
          <p className="mt-1 text-sm leading-6 text-ink/65">
            {getExceptionText(activeException.eventType)}
          </p>
          {activeException.note ? <p className="mt-2 rounded-md bg-white/70 p-2 text-xs leading-5 text-ink/60">{activeException.note}</p> : null}
          <p className="mt-2 text-xs leading-5 text-ink/55">
            在医生确认前，不要仅根据应用日程自行换到下一副或回退上一副。可在设置页标记已解决或取消记录。
          </p>
          <button
            className="mt-3 min-h-10 w-full rounded-md bg-ink px-4 text-sm font-semibold text-white"
            onClick={() => { window.location.href = "/settings"; }}
            type="button"
          >
            去设置页处理异常
          </button>
        </section>
      ) : null}

      {appointmentExtensionSuggestion && !activeException ? (
        <section className="rounded-md border border-amber/25 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-[0.18em] text-amber">复诊衔接</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">建议延戴到复诊日</h2>
          <p className="mt-1 text-sm leading-6 text-ink/60">
            第 {appointmentExtensionSuggestion.trayNumber} 副原计划 {formatDateShort(appointmentExtensionSuggestion.plannedEndDate)} 结束，复诊在 {formatDateShort(appointmentExtensionSuggestion.appointmentDate)}。默认建议记录为延戴 {appointmentExtensionSuggestion.extensionDays} 天，等医生确认后再导入下一阶段。
          </p>
          <button
            className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={appointmentExtendPending}
            onClick={extendLastTrayToAppointment}
            type="button"
          >
            {appointmentExtendPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            延戴到复诊日
          </button>
        </section>
      ) : null}

      {isTrayDue ? (
        <section className="rounded-md border border-mint/25 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-[0.18em] text-sage">换期确认</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">
            {canAdvanceTray ? `是否已换到第 ${planProgress!.currentTrayNumber + 1} 副？` : "当前阶段已到计划结束日"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink/60">
            {canAdvanceTray
              ? "系统不会自动推进牙套副数。只有你确认已经按医生安排换到下一副后，首页和日程才会更新。"
              : "已经是当前阶段最后一副。请按医生安排记录等待精修/复扫/保持器，或在设置页导入下一阶段计划。"}
          </p>
          {canAdvanceTray ? (
            <button
              className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-mint px-4 text-sm font-semibold text-white disabled:opacity-60"
              disabled={advancePending || Boolean(activeException)}
              onClick={advanceTray}
              type="button"
            >
              {advancePending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              确认已换到下一副
            </button>
          ) : null}
          <button
            className="mt-2 min-h-11 w-full rounded-md border border-ink/10 px-4 text-sm font-semibold text-ink"
            onClick={() => { window.location.href = "/settings"; }}
            type="button"
          >
            需要异常处理
          </button>
          {advanceMessage ? <p className={`mt-3 text-xs ${advanceMessage.startsWith("已") ? "text-sage" : "text-coral"}`}>{advanceMessage}</p> : null}
        </section>
      ) : null}

      <section className={`rounded-md border p-5 shadow-soft ${
        isWearing ? "border-mint/25 bg-white" : "border-coral/25 bg-coral/10"
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink/60">当前状态</p>
            <h2 className="mt-1 text-4xl font-semibold text-ink">{isWearing ? "佩戴中" : "已取下"}</h2>
          </div>
          <div className={`rounded-md p-3 ${isWearing ? "bg-mint/10 text-mint" : "bg-coral/10 text-coral"}`}>
            {isWearing ? <ShieldCheck className="h-7 w-7" /> : <Utensils className="h-7 w-7" />}
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-ink/60">今日目标进度</span>
            <span className="font-semibold text-ink">{todaySummary.hasData ? formatPercent(progress) : "暂无记录"}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-mist">
            <div className="h-full rounded-full bg-mint transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <TodayInlineStat
            helper={`目标 ${formatMinutes(treatmentPlan.dailyGoalMinutes)}`}
            label="今日已戴"
            value={todaySummary.hasData ? formatMinutes(todaySummary.wearMinutes) : "暂无记录"}
          />
          <TodayInlineStat
            label={isWearing ? "还差" : "当前已取下"}
            value={todaySummary.hasData ? isWearing ? formatMinutes(Math.max(0, treatmentPlan.dailyGoalMinutes - todaySummary.wearMinutes)) : formatMinutes(activeOutMinutes) : "首次打卡后计算"}
          />
          <TodayInlineStat
            helper="今日记录"
            label="取下次数"
            value={String(todaySummary.sessionCount)}
          />
          <TodayInlineStat
            label="总取下"
            value={formatMinutes(todaySummary.offMinutes)}
          />
        </div>

        <button
          className={`mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-md px-5 text-base font-semibold text-white transition disabled:opacity-60 ${
            isWearing ? "bg-ink hover:bg-ink/90" : "bg-mint hover:bg-mint/90"
          }`}
          disabled={pending}
          onClick={toggle}
          type="button"
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Clock className="h-5 w-5" />}
          {isWearing ? "我取下牙套了" : "我戴回牙套了"}
        </button>
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
        <div>
          <h2 className="font-semibold text-ink">补记取下时间</h2>
          <p className="mt-1 text-sm leading-6 text-ink/60">
            用于修正忘记点击取下或忘记点击戴回的情况。
          </p>
        </div>
        {!manualOpen ? (
          <button
            className="mt-4 flex min-h-11 w-full items-center justify-center rounded-md bg-ink px-4 text-sm font-semibold text-white"
            onClick={() => setManualOpen(true)}
            type="button"
          >
            打开补记
          </button>
        ) : null}
        {manualOpen ? (
          <div className="mt-4 space-y-3">
            <div className="grid gap-2">
              <button
                className={`min-h-11 rounded-md border px-3 text-sm font-semibold ${manualMode === "closed_session" ? "border-ink bg-ink text-white" : "border-ink/10 text-ink"}`}
                onClick={() => setManualMode("closed_session")}
                type="button"
              >
                忘记取下 · 已戴回
              </button>
              <button
                className={`min-h-11 rounded-md border px-3 text-sm font-semibold ${manualMode === "forgot_take_off_open" ? "border-ink bg-ink text-white" : "border-ink/10 text-ink"}`}
                onClick={() => setManualMode("forgot_take_off_open")}
                type="button"
              >
                忘记取下 · 还没戴回
              </button>
              <button
                className={`min-h-11 rounded-md border px-3 text-sm font-semibold ${manualMode === "forgot_put_back" ? "border-ink bg-ink text-white" : "border-ink/10 text-ink"}`}
                onClick={() => setManualMode("forgot_put_back")}
                type="button"
              >
                忘记点戴回
              </button>
              <button
                className={`min-h-11 rounded-md border px-3 text-sm font-semibold ${manualMode === "wearing_baseline" ? "border-ink bg-ink text-white" : "border-ink/10 text-ink"}`}
                onClick={() => setManualMode("wearing_baseline")}
                type="button"
              >
                补记此前已佩戴
              </button>
            </div>
            {manualMode !== "forgot_put_back" ? (
              <label className="block text-sm font-medium text-ink/70">
                {manualMode === "wearing_baseline" ? "开始佩戴/开始追踪时间" : "实际取下时间"}
                <input
                  className="mt-2 min-h-12 w-full rounded-md border border-ink/10 bg-paper px-3 text-ink outline-none focus:border-mint"
                  max={toDateTimeLocalValue(new Date())}
                  onChange={(event) => setManualStart(event.target.value)}
                  type="datetime-local"
                  value={manualStart}
                />
              </label>
            ) : null}
            {manualMode === "closed_session" || manualMode === "forgot_put_back" ? (
              <label className="block text-sm font-medium text-ink/70">
                实际戴回时间
                <input
                  className="mt-2 min-h-12 w-full rounded-md border border-ink/10 bg-paper px-3 text-ink outline-none focus:border-mint"
                  max={toDateTimeLocalValue(new Date())}
                  onChange={(event) => setManualEnd(event.target.value)}
                  type="datetime-local"
                  value={manualEnd}
                />
              </label>
            ) : null}
            <p className="text-xs leading-5 text-ink/50">
              {getManualHelperText(manualMode)}
            </p>
            <button
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white disabled:opacity-60"
              disabled={manualPending || (manualMode !== "forgot_put_back" && !manualStart) || ((manualMode === "closed_session" || manualMode === "forgot_put_back") && !manualEnd)}
              onClick={saveManualSession}
              type="button"
            >
              {manualPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {getManualButtonText(manualMode)}
            </button>
            <button
              className="flex min-h-11 w-full items-center justify-center rounded-md border border-ink/10 px-4 text-sm font-semibold text-ink"
              onClick={() => {
                setManualOpen(false);
                setManualStart("");
                setManualEnd("");
                setManualMode("closed_session");
              }}
              type="button"
            >
              取消补记
            </button>
          </div>
        ) : null}
        {manualMessage ? <p className={`mt-3 text-xs ${manualMessage.startsWith("已") ? "text-sage" : "text-coral"}`}>{manualMessage}</p> : null}
      </section>

      <button
        className="flex min-h-11 w-full items-center justify-center rounded-md border border-ink/10 bg-white px-4 text-sm font-semibold text-ink shadow-sm"
        onClick={() => { window.location.href = "/calendar"; }}
        type="button"
      >
        记录今日札记 / 阶段照片
      </button>

      {!todaySummary.hasData ? (
        <p className="rounded-md border border-amber/20 bg-white/80 p-3 text-xs leading-5 text-ink/60">
          今天还没有真实佩戴记录。第一次点击“我取下牙套了”后，系统才会开始计算今日已戴、取下次数和趋势数据。
        </p>
      ) : null}

      <p className="rounded-md border border-ink/10 bg-mist/70 p-3 text-xs leading-5 text-ink/60">
        Loo牙管理器用于记录和理解佩戴计划，不提供诊断或换牙套决策；请以牙医/正畸医生指导为准。
      </p>
    </div>
  );
}

function TodayInlineStat(props: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-md bg-mist/70 px-3 py-2">
      <p className="text-xs text-ink/45">{props.label}</p>
      <p className="mt-1 text-base font-semibold leading-tight text-ink">{props.value}</p>
      {props.helper ? <p className="mt-0.5 text-[0.65rem] leading-4 text-ink/45">{props.helper}</p> : null}
    </div>
  );
}

function toDateTimeLocalValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatDateShort(dateKey: string | null) {
  if (!dateKey) {
    return "待确认";
  }

  const [, month, day] = dateKey.split("-").map(Number);

  return `${month}月${day}日`;
}

function formatWeekday(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);

  return new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);
}

function getManualHelperText(mode: ManualMode) {
  if (mode === "wearing_baseline") {
    return "适合开始使用 App 前已经佩戴牙套的空白时间；只修正佩戴统计起点，不增加取下次数。";
  }

  if (mode === "closed_session") {
    return "适合忘记点“我取下牙套了”，但后来已经戴回的情况；会补回一段已结束的未佩戴时间。";
  }

  if (mode === "forgot_take_off_open") {
    return "适合已经取下牙套但忘记点击按钮的情况；保存后当前状态会变成“已取下”，并从这个时间开始计时。";
  }

  return "适合应用仍显示“已取下”，但你其实早已戴回的情况；会用实际戴回时间关闭当前取下记录。";
}

function getManualButtonText(mode: ManualMode) {
  if (mode === "wearing_baseline") {
    return "保存此前已佩戴";
  }

  if (mode === "closed_session") {
    return "保存已结束时段";
  }

  if (mode === "forgot_take_off_open") {
    return "保存为当前已取下";
  }

  return "保存实际戴回时间";
}

function getManualSuccessText(mode: ManualMode) {
  if (mode === "wearing_baseline") {
    return "已补记此前已佩戴时间。";
  }

  if (mode === "closed_session") {
    return "已补记这段取下时间。";
  }

  if (mode === "forgot_take_off_open") {
    return "已补记取下时间，当前状态已改为已取下。";
  }

  return "已按实际戴回时间关闭取下记录。";
}

function formatExceptionType(type: NonNullable<AppSnapshot["activeException"]>["eventType"]) {
  const labels: Record<NonNullable<AppSnapshot["activeException"]>["eventType"], string> = {
    late_change: "延迟换期",
    tray_extension: "当前副延戴",
    extend_current_tray: "当前副延戴",
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

function DualProgressRings(props: { stagePercent: number; trayPercent: number }) {
  const stagePercent = clampPercent(props.stagePercent);
  const trayPercent = clampPercent(props.trayPercent);

  return (
    <div className="shrink-0 text-center">
      <p className="mb-1 text-[0.65rem] font-medium text-ink/50">阶段完成进度</p>
      <div className="relative h-24 w-24">
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{ background: progressRingBackground(stagePercent, "#6f8f7c", "#e8efeb") }}
        />
        <div className="absolute inset-2 rounded-full bg-white" />
        <div
          aria-hidden="true"
          className="absolute inset-4 rounded-full"
          style={{ background: progressRingBackground(trayPercent, "#c7655d", "#f1e7df") }}
        />
        <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-white">
          <p className="text-sm font-semibold leading-none text-ink">{formatPercent(stagePercent)}</p>
          <p className="mt-1 text-[0.6rem] leading-none text-ink/45">阶段</p>
        </div>
      </div>
      <p className="mt-1 text-[0.65rem] leading-4 text-ink/50">当前副 {formatPercent(trayPercent)}</p>
    </div>
  );
}

function getCurrentTrayProgressPercent(progress: NonNullable<AppSnapshot["planProgress"]>) {
  if (progress.currentTrayProgressPercent === null || progress.label !== "on_track") {
    return 0;
  }

  return clampPercent(progress.currentTrayProgressPercent);
}

function getStageProgressPercent(progress: NonNullable<AppSnapshot["planProgress"]>, currentTrayPercent: number) {
  if (!progress.totalTrays || progress.totalTrays <= 0) {
    return 0;
  }

  const completedTrays = Math.max(0, progress.currentTrayNumber - 1);
  const currentTrayFraction = progress.label === "on_track" ? clampPercent(currentTrayPercent) / 100 : 0;

  return clampPercent(((completedTrays + currentTrayFraction) / progress.totalTrays) * 100);
}

function progressRingBackground(percent: number, activeColor: string, inactiveColor: string) {
  return `conic-gradient(${activeColor} ${clampPercent(percent)}%, ${inactiveColor} 0)`;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function formatSeriesType(seriesType: NonNullable<AppSnapshot["activeSeries"]>["seriesType"] | undefined) {
  const labels: Record<NonNullable<AppSnapshot["activeSeries"]>["seriesType"], string> = {
    active: "主动移动",
    refinement: "精修",
    holding: "保持/等待",
    retainer: "保持器"
  };

  return seriesType ? labels[seriesType] : "阶段";
}

function getExceptionText(type: NonNullable<AppSnapshot["activeException"]>["eventType"]) {
  if (type === "late_change" || type === "tray_extension" || type === "extend_current_tray") {
    return "当前牙套日程已按记录顺延。请确认医生要求后再进入下一副。";
  }

  if (type === "waiting_refinement" || type === "waiting_rescan" || type === "waiting_retainer") {
    return "当前计划处于等待状态，换期倒计时已暂停。";
  }

  return "此情况只做记录和提醒，不自动建议换副或回退。";
}
