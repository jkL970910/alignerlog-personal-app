"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Loader2, ShieldCheck, Utensils } from "lucide-react";

import { formatMinutes, formatPercent } from "@/lib/format";
import type { AppSnapshot } from "@/lib/types";

import { MetricCard } from "./metric-card";
import { SetupWarning } from "./setup-warning";

type ApiState =
  | { status: "loading"; data?: never; error?: never }
  | { status: "ready"; data: AppSnapshot; error?: never }
  | { status: "error"; data?: never; error: string };

export function TodayDashboard() {
  const [state, setState] = useState<ApiState>({ status: "loading" });
  const [pending, setPending] = useState(false);

  async function load() {
    const response = await fetch("/api/snapshot");
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
          "Content-Type": "application/json",
          "X-Loo-Source": "today-dashboard"
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
            <div className="rounded-md bg-mist px-3 py-2 text-right">
              <p className="text-xs text-ink/50">下次换期</p>
              <p className="font-semibold text-ink">{planProgress.nextChangeDate ?? "待确认"}</p>
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
