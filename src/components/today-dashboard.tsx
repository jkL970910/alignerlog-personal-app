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
      throw new Error(payload.error ?? "Could not load today.");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: "meal" })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update status.");
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
      setState({ status: "error", error: error instanceof Error ? error.message : "Could not update status." });
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
  const isWearing = wearState.isWearing;
  const progress = Math.min(100, (todaySummary.wearMinutes / treatmentPlan.dailyGoalMinutes) * 100);
  const activeOutMinutes = activeSession
    ? Math.max(0, Math.floor((Date.now() - new Date(activeSession.startAt).getTime()) / 60000))
    : 0;

  return (
    <div className="space-y-4">
      <section className={`rounded-md border p-5 shadow-soft ${
        isWearing ? "border-mint/25 bg-white" : "border-coral/25 bg-coral/10"
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink/60">Current status</p>
            <h2 className="mt-1 text-4xl font-semibold text-ink">{isWearing ? "Wearing" : "Out"}</h2>
          </div>
          <div className={`rounded-md p-3 ${isWearing ? "bg-mint/10 text-mint" : "bg-coral/10 text-coral"}`}>
            {isWearing ? <ShieldCheck className="h-7 w-7" /> : <Utensils className="h-7 w-7" />}
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-ink/60">Daily goal progress</span>
            <span className="font-semibold text-ink">{formatPercent(progress)}</span>
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
          {isWearing ? "I took my aligners out" : "I put my aligners back in"}
        </button>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Worn today" value={formatMinutes(todaySummary.wearMinutes)} helper={`Goal ${formatMinutes(treatmentPlan.dailyGoalMinutes)}`} />
        <MetricCard label={isWearing ? "Remaining" : "Out for"} value={isWearing ? formatMinutes(Math.max(0, treatmentPlan.dailyGoalMinutes - todaySummary.wearMinutes)) : formatMinutes(activeOutMinutes)} />
        <MetricCard label="Sessions" value={String(todaySummary.sessionCount)} helper="Off-tray today" />
        <MetricCard label="Longest out" value={formatMinutes(todaySummary.longestOffSessionMinutes)} />
      </div>

      <p className="rounded-md border border-ink/10 bg-mist/70 p-3 text-xs leading-5 text-ink/60">
        Follow your orthodontist&apos;s instructions for wear time and tray changes.
      </p>
    </div>
  );
}
