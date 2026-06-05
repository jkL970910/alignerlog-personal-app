"use client";

import { useEffect, useState } from "react";
import { Clock, Loader2, ShieldCheck, Utensils } from "lucide-react";

import { formatMinutes, formatPercent } from "@/lib/format";
import { timeZoneHeaders } from "@/lib/client-time-zone";
import type { AppSnapshot } from "@/lib/types";

import { MetricCard } from "./metric-card";
import { SetupWarning } from "./setup-warning";

type ApiState =
  | { status: "loading"; data?: never; error?: never }
  | { status: "ready"; data: AppSnapshot; error?: never }
  | { status: "error"; data?: never; error: string };

type ManualMode = "closed_session" | "forgot_take_off_open" | "forgot_put_back";

export function TodayDashboard() {
  const [state, setState] = useState<ApiState>({ status: "loading" });
  const [pending, setPending] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualMode, setManualMode] = useState<ManualMode>("closed_session");
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [manualPending, setManualPending] = useState(false);
  const [manualMessage, setManualMessage] = useState<string | null>(null);

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

  const { wearState, activeSession, todaySummary, treatmentPlan } = state.data;
  const planProgress = state.data.planProgress;
  const isWearing = wearState.isWearing;
  const progress = todaySummary.hasData ? Math.min(100, (todaySummary.wearMinutes / treatmentPlan.dailyGoalMinutes) * 100) : 0;
  const activeOutMinutes = activeSession
    ? Math.max(0, Math.floor((Date.now() - new Date(activeSession.startAt).getTime()) / 60000))
    : 0;

  return (
    <div className="space-y-4">
      {planProgress ? (
        <section className="rounded-md border border-amber/20 bg-white/90 p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-[0.18em] text-sage">当前计划</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-ink">
                第 {planProgress.currentTrayNumber} / {planProgress.totalTrays ?? "?"} 副
              </h2>
              <p className="mt-1 text-sm text-ink/60">{getProgressText(planProgress)}</p>
            </div>
            <div className="min-w-[5.75rem] rounded-md bg-mist px-3 py-2 text-center">
              <p className="text-xs text-ink/50">下次换期</p>
              <p className="mt-1 font-semibold leading-tight text-ink">{formatDateShort(planProgress.nextChangeDate)}</p>
              {planProgress.nextChangeDate ? <p className="mt-0.5 text-xs text-ink/45">{formatWeekday(planProgress.nextChangeDate)}</p> : null}
            </div>
          </div>
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
            </div>
            {manualMode !== "forgot_put_back" ? (
              <label className="block text-sm font-medium text-ink/70">
                实际取下时间
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

      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="今日已戴" value={todaySummary.hasData ? formatMinutes(todaySummary.wearMinutes) : "暂无记录"} helper={`目标 ${formatMinutes(treatmentPlan.dailyGoalMinutes)}`} />
        <MetricCard label={isWearing ? "还差" : "已取下"} value={todaySummary.hasData ? isWearing ? formatMinutes(Math.max(0, treatmentPlan.dailyGoalMinutes - todaySummary.wearMinutes)) : formatMinutes(activeOutMinutes) : "首次打卡后计算"} />
        <MetricCard label="取下次数" value={String(todaySummary.sessionCount)} helper="今日记录" />
        <MetricCard label="最长取下" value={formatMinutes(todaySummary.longestOffSessionMinutes)} />
      </div>

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
  if (mode === "closed_session") {
    return "适合忘记点“我取下牙套了”，但后来已经戴回的情况；会补回一段已结束的未佩戴时间。";
  }

  if (mode === "forgot_take_off_open") {
    return "适合已经取下牙套但忘记点击按钮的情况；保存后当前状态会变成“已取下”，并从这个时间开始计时。";
  }

  return "适合应用仍显示“已取下”，但你其实早已戴回的情况；会用实际戴回时间关闭当前取下记录。";
}

function getManualButtonText(mode: ManualMode) {
  if (mode === "closed_session") {
    return "保存已结束时段";
  }

  if (mode === "forgot_take_off_open") {
    return "保存为当前已取下";
  }

  return "保存实际戴回时间";
}

function getManualSuccessText(mode: ManualMode) {
  if (mode === "closed_session") {
    return "已补记这段取下时间。";
  }

  if (mode === "forgot_take_off_open") {
    return "已补记取下时间，当前状态已改为已取下。";
  }

  return "已按实际戴回时间关闭取下记录。";
}

function getProgressText(progress: NonNullable<AppSnapshot["planProgress"]>) {
  if (progress.label === "holding") {
    return "当前处于保持/被动佩戴，请按医生安排等待下一步。";
  }

  if (progress.label === "paused") {
    return "当前计划暂停或等待精修，换期时间以医生确认 为准。";
  }

  if (progress.label === "retainer") {
    return "当前为保持器阶段，佩戴方式以医生指导为准。";
  }

  if (progress.label === "not_started") {
    return "计划尚未开始，可先保留日程预览。";
  }

  const dayText = progress.currentTrayDay ? `当前第 ${progress.currentTrayDay} 天` : "当前天数待确认";
  const nextText = progress.daysUntilNextChange === null
    ? "下次换期待确认"
    : progress.daysUntilNextChange <= 0
      ? "已到计划换期日"
      : `距离计划换期 ${progress.daysUntilNextChange} 天`;
  const remainingText = progress.traysRemaining === null ? "" : `，剩余 ${progress.traysRemaining} 副`;

  return `${dayText}，${nextText}${remainingText}。`;
}
