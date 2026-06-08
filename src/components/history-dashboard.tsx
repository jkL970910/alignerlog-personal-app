"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2 } from "lucide-react";

import { addDaysToDateKey } from "@/lib/dates";
import { formatMinutes, formatPercent } from "@/lib/format";
import { getClientDateKey, timeZoneHeaders } from "@/lib/client-time-zone";
import type { DailySummary, OffTrayReason, OffTraySession } from "@/lib/types";
import type { HistoryMetrics } from "@/lib/summaries";

import { MetricCard } from "./metric-card";
import { SetupWarning } from "./setup-warning";

type HistoryPayload = {
  summaries: DailySummary[];
  metrics: HistoryMetrics;
  today: string;
};

type SessionDraft = {
  id?: string;
  startLocal: string;
  endLocal: string;
  reason: OffTrayReason;
};

type RangePreset = "7d" | "15d" | "30d" | "month";

const reasonOptions: Array<{ value: OffTrayReason; label: string }> = [
  { value: "meal", label: "进食" },
  { value: "drink", label: "饮品" },
  { value: "brushing", label: "刷牙" },
  { value: "other", label: "其他" }
];

const rangeOptions: Array<{ value: RangePreset; label: string }> = [
  { value: "7d", label: "近7天" },
  { value: "15d", label: "近15天" },
  { value: "30d", label: "近30天" },
  { value: "month", label: "按月" }
];

export function HistoryDashboard() {
  const [data, setData] = useState<HistoryPayload | null>(null);
  const [dataRangeLabel, setDataRangeLabel] = useState("近30天");
  const [error, setError] = useState<string | null>(null);
  const [historyPending, setHistoryPending] = useState(true);
  const [rangePreset, setRangePreset] = useState<RangePreset>("30d");
  const [monthKey, setMonthKey] = useState(() => getClientDateKey().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sessions, setSessions] = useState<OffTraySession[]>([]);
  const [sessionDraft, setSessionDraft] = useState<SessionDraft>(() => createEmptyDraft());
  const [sessionPending, setSessionPending] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  async function loadHistory() {
    const payload = await fetchHistory(rangePreset, monthKey);

    setData(payload);
    setDataRangeLabel(formatRangeLabel(rangePreset, monthKey));
  }

  useEffect(() => {
    let cancelled = false;
    const nextRangeLabel = formatRangeLabel(rangePreset, monthKey);

    setHistoryPending(true);
    setError(null);
    setSelectedDate(null);
    setSessions([]);
    setSessionMessage(null);
    setSessionDraft(createEmptyDraft());
    fetchHistory(rangePreset, monthKey)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setData(payload);
        setDataRangeLabel(nextRangeLabel);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryPending(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [rangePreset, monthKey]);

  async function openDay(date: string) {
    if (selectedDate === date) {
      setSelectedDate(null);
      setSessions([]);
      setSessionMessage(null);
      setSessionDraft(createEmptyDraft());
      return;
    }

    setSelectedDate(date);
    setSessionMessage(null);
    setSessionDraft(createDefaultDraft(date));
    await loadSessions(date);
  }

  async function loadSessions(date: string) {
    const response = await fetch(`/api/sessions?date=${encodeURIComponent(date)}`, {
      headers: timeZoneHeaders()
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "无法载入当天取下记录。");
    }

    setSessions(payload.sessions);
  }

  async function saveSessionDraft() {
    if (!selectedDate) {
      return;
    }

    setSessionPending(true);
    setSessionMessage(null);

    try {
      const response = await fetch(sessionDraft.id ? `/api/sessions/${sessionDraft.id}` : "/api/sessions", {
        method: sessionDraft.id ? "PATCH" : "POST",
        headers: timeZoneHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          startLocal: sessionDraft.startLocal,
          endLocal: sessionDraft.endLocal,
          reason: sessionDraft.reason
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "无法保存取下记录。");
      }

      await loadSessions(selectedDate);
      await loadHistory();
      setSessionDraft(createDefaultDraft(selectedDate));
      setSessionMessage(payload.session ? "已保存取下记录。" : "已保存。");
    } catch (err) {
      setSessionMessage(err instanceof Error ? err.message : "无法保存取下记录。");
    } finally {
      setSessionPending(false);
    }
  }

  async function deleteSession(sessionId: string) {
    if (!selectedDate) {
      return;
    }

    setSessionPending(true);
    setSessionMessage(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
        headers: timeZoneHeaders()
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "无法删除取下记录。");
      }

      await loadSessions(selectedDate);
      await loadHistory();
      setSessionDraft(createDefaultDraft(selectedDate));
      setSessionMessage("已删除取下记录。");
    } catch (err) {
      setSessionMessage(err instanceof Error ? err.message : "无法删除取下记录。");
    } finally {
      setSessionPending(false);
    }
  }

  if (error && !data) {
    return <SetupWarning message={error} />;
  }

  if (!data) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-md border border-ink/10 bg-white/75">
        <Loader2 className="h-6 w-6 animate-spin text-sage" />
      </div>
    );
  }

  const recordedSummaries = data.summaries.filter((summary) => summary.hasData);
  const chartData = recordedSummaries.map((summary) => ({
    date: summary.date.slice(5),
    hours: Number((summary.wearMinutes / 60).toFixed(1)),
    inProgress: summary.date === data.today
  }));
  const activeRangeLabel = historyPending || error ? dataRangeLabel : formatRangeLabel(rangePreset, monthKey);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="当前已连续坚持佩戴"
          value={`${data.metrics.currentGoalStreak}天`}
        />
        <GoalStatsMetricCard
          monthlyGoalStats={data.metrics.monthlyGoalStats}
          overallGoalStats={data.metrics.overallGoalStats}
        />
        <MetricCard
          label="7日均值"
          value={formatMinutes(data.metrics.sevenDayAverage)}
        />
        <MetricCard
          label="历史最长"
          value={`${data.metrics.longestGoalStreak}天`}
        />
      </div>

      <section className="rounded-md border border-ink/10 bg-white p-3 shadow-sm">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {rangeOptions.map((option) => (
            <button
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                rangePreset === option.value ? "bg-ink text-white" : "border border-ink/10 bg-white text-ink/60"
              }`}
              key={option.value}
              onClick={() => setRangePreset(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        {rangePreset === "month" ? (
          <label className="mt-3 block text-xs font-medium text-ink/55">
            月份
            <input
              className="mt-1 min-h-10 w-full rounded-md border border-ink/10 bg-paper px-3 text-sm text-ink"
              max={getClientDateKey().slice(0, 7)}
              onChange={(event) => setMonthKey(event.target.value || getClientDateKey().slice(0, 7))}
              type="month"
              value={monthKey}
            />
          </label>
        ) : null}
        {error ? <p className="mt-2 text-xs text-coral">{error}</p> : null}
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-ink">{activeRangeLabel}趋势</h2>
        {chartData.length ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 0, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dfe7e3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#6f8f7c" />
                <YAxis tick={{ fontSize: 11 }} stroke="#6f8f7c" />
                <Tooltip formatter={(value, _name, item) => [`${value}小时`, item.payload.inProgress ? "今日进行中" : "已佩戴"]} />
                <Bar dataKey="hours" radius={[4, 4, 0, 0]} fill="#c7655d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="rounded-md bg-mist/70 p-4 text-sm leading-6 text-ink/60">
            暂无真实趋势。完成第一次取下/戴回记录后，这里才会生成佩戴柱状图和均值。
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-ink">{activeRangeLabel}记录</h2>
        {recordedSummaries.slice().reverse().map((summary) => (
          <div className="rounded-md border border-ink/10 bg-white/80 p-3" key={summary.date}>
            <button
              className="flex w-full items-center justify-between text-left"
              onClick={() => {
                openDay(summary.date).catch((err: Error) => setSessionMessage(err.message));
              }}
              type="button"
            >
              <div>
                <p className="font-medium text-ink">{summary.date}</p>
                <p className="text-sm text-ink/60">取下 {summary.sessionCount} 次 · 点开编辑</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-ink">{formatMinutes(summary.wearMinutes)}</p>
                <p className={`text-sm ${summary.date === data.today ? "text-sage" : summary.goalMet ? "text-mint" : "text-coral"}`}>
                  {summary.date === data.today ? "进行中" : summary.goalMet ? "已达标" : "未达标"}
                </p>
              </div>
            </button>
            {selectedDate === summary.date ? (
              <div className="mt-3 space-y-3">
                <DaySessionEditor
                  draft={sessionDraft}
                  message={sessionMessage}
                  onCancelEdit={() => setSessionDraft(createDefaultDraft(summary.date))}
                  onDelete={deleteSession}
                  onDraftChange={setSessionDraft}
                  onEdit={(session) => setSessionDraft(createDraftFromSession(session))}
                  onSave={saveSessionDraft}
                  pending={sessionPending}
                  sessions={sessions}
                />
                <section className="rounded-lg border border-ink/10 bg-white/80 p-4 shadow-sm">
                  <p className="text-xs font-semibold tracking-[0.16em] text-sage">阶段照片</p>
                  <h3 className="mt-1 text-lg font-semibold text-ink">去日历管理当天照片</h3>
                  <p className="mt-1 text-sm leading-6 text-ink/60">
                    照片上传、角度完成度和阶段对比都在日历当天详情里处理，避免趋势页重复一套拍照流程。
                  </p>
                  <button
                    className="mt-3 min-h-11 w-full rounded-md bg-ink px-4 text-sm font-semibold text-white"
                    onClick={() => { window.location.href = `/calendar?date=${encodeURIComponent(summary.date)}`; }}
                    type="button"
                  >
                    打开这一天的照片档案
                  </button>
                </section>
              </div>
            ) : null}
          </div>
        ))}
        {!recordedSummaries.length ? (
          <div className="rounded-md border border-ink/10 bg-white/80 p-3 text-sm text-ink/60">
            这个范围还没有可回看的佩戴记录。
          </div>
        ) : null}
      </section>
    </div>
  );
}

function GoalStatsMetricCard(props: {
  monthlyGoalStats: HistoryMetrics["monthlyGoalStats"];
  overallGoalStats: HistoryMetrics["overallGoalStats"];
}) {
  return (
    <div className="rounded-md border border-ink/10 bg-white/80 p-4 shadow-sm">
      <p className="text-xs font-medium uppercase text-ink/50">达标统计</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-ink/45">本月</p>
          <p className="mt-1 text-xl font-semibold text-ink">
            {props.monthlyGoalStats.goalMetDays}/{props.monthlyGoalStats.trackedDays}天
          </p>
          <p className="mt-0.5 text-xs text-ink/55">{formatPercent(props.monthlyGoalStats.recordedGoalRate)}</p>
        </div>
        <div>
          <p className="text-xs text-ink/45">总体</p>
          <p className="mt-1 text-xl font-semibold text-ink">
            {props.overallGoalStats.goalMetDays}/{props.overallGoalStats.trackedDays}天
          </p>
          <p className="mt-0.5 text-xs text-ink/55">{formatPercent(props.overallGoalStats.goalRate)}</p>
        </div>
      </div>
    </div>
  );
}

function getHistoryRange(preset: RangePreset, month: string) {
  const today = getClientDateKey();

  if (preset === "month") {
    const safeMonth = month || today.slice(0, 7);
    const start = `${safeMonth}-01`;
    const monthEnd = getMonthEndDateKey(safeMonth);
    const end = safeMonth === today.slice(0, 7) ? today : monthEnd;

    return { start, end };
  }

  const days = preset === "7d" ? 7 : preset === "15d" ? 15 : 30;

  return {
    start: addDaysToDateKey(today, -(days - 1)),
    end: today
  };
}

function getMonthEndDateKey(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0));

  return [
    String(lastDay.getUTCFullYear()).padStart(4, "0"),
    String(lastDay.getUTCMonth() + 1).padStart(2, "0"),
    String(lastDay.getUTCDate()).padStart(2, "0")
  ].join("-");
}

function formatRangeLabel(preset: RangePreset, month: string) {
  if (preset === "month") {
    return month === getClientDateKey().slice(0, 7) ? "本月" : `${month} 月度`;
  }

  return rangeOptions.find((option) => option.value === preset)?.label ?? "近30天";
}

async function fetchHistory(rangePreset: RangePreset, monthKey: string) {
  const range = getHistoryRange(rangePreset, monthKey);
  const params = new URLSearchParams({ start: range.start, end: range.end });
  const response = await fetch(`/api/summaries?${params.toString()}`, { headers: timeZoneHeaders() });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "无法载入历史趋势。");
  }

  return payload as HistoryPayload;
}

function DaySessionEditor(props: {
  draft: SessionDraft;
  message: string | null;
  onCancelEdit: () => void;
  onDelete: (sessionId: string) => void;
  onDraftChange: (draft: SessionDraft) => void;
  onEdit: (session: OffTraySession) => void;
  onSave: () => void;
  pending: boolean;
  sessions: OffTraySession[];
}) {
  return (
    <div className="mt-3 rounded-md bg-mist/60 p-3">
      <p className="text-xs leading-5 text-ink/60">
        这里编辑的是当天“取下牙套”的原始时段。新增、修改或删除后，佩戴时长和达标状态会重新计算。
      </p>

      <div className="mt-3 space-y-2">
        {props.sessions.length ? props.sessions.map((session) => (
          <div className="rounded-md bg-white/80 p-2 text-xs text-ink/70" key={session.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-ink">{formatLocalTime(session.startAt)} - {session.endAt ? formatLocalTime(session.endAt) : "进行中"}</p>
                <p className="mt-1">{formatReason(session.reason)} · {session.endAt ? formatSessionDuration(session) : "请在首页结束"}</p>
              </div>
              <div className="grid gap-1">
                {session.endAt ? (
                  <button className="rounded border border-ink/10 px-2 py-1 font-semibold text-ink" onClick={() => props.onEdit(session)} type="button">
                    修改
                  </button>
                ) : null}
                {session.endAt ? (
                  <button className="rounded border border-coral/20 px-2 py-1 font-semibold text-coral disabled:opacity-60" disabled={props.pending} onClick={() => props.onDelete(session.id)} type="button">
                    删除
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )) : (
          <p className="rounded-md bg-white/70 p-2 text-xs text-ink/55">这一天还没有取下记录，可以在下方新增。</p>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <p className="text-xs font-semibold tracking-[0.16em] text-ink/45">{props.draft.id ? "修改记录" : "新增取下记录"}</p>
        <label className="block text-xs font-medium text-ink/70">
          取下时间
          <input
            className="mt-1 min-h-10 w-full rounded-md border border-ink/10 bg-paper px-3 text-ink outline-none focus:border-mint"
            onChange={(event) => props.onDraftChange({ ...props.draft, startLocal: event.target.value })}
            type="datetime-local"
            value={props.draft.startLocal}
          />
        </label>
        <label className="block text-xs font-medium text-ink/70">
          戴回时间
          <input
            className="mt-1 min-h-10 w-full rounded-md border border-ink/10 bg-paper px-3 text-ink outline-none focus:border-mint"
            onChange={(event) => props.onDraftChange({ ...props.draft, endLocal: event.target.value })}
            type="datetime-local"
            value={props.draft.endLocal}
          />
        </label>
        <label className="block text-xs font-medium text-ink/70">
          原因
          <select
            className="mt-1 min-h-10 w-full rounded-md border border-ink/10 bg-paper px-3 text-ink outline-none focus:border-mint"
            onChange={(event) => props.onDraftChange({ ...props.draft, reason: event.target.value as OffTrayReason })}
            value={props.draft.reason}
          >
            {reasonOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            className="min-h-10 rounded-md bg-ink px-3 text-xs font-semibold text-white disabled:opacity-60"
            disabled={props.pending || !props.draft.startLocal || !props.draft.endLocal}
            onClick={props.onSave}
            type="button"
          >
            {props.pending ? "保存中..." : props.draft.id ? "保存修改" : "新增记录"}
          </button>
          <button className="min-h-10 rounded-md border border-ink/10 px-3 text-xs font-semibold text-ink" onClick={props.onCancelEdit} type="button">
            清空
          </button>
        </div>
        {props.message ? <p className={`text-xs ${props.message.startsWith("已") ? "text-sage" : "text-coral"}`}>{props.message}</p> : null}
      </div>
    </div>
  );
}

function createEmptyDraft(): SessionDraft {
  return {
    startLocal: "",
    endLocal: "",
    reason: "meal"
  };
}

function createDefaultDraft(date: string): SessionDraft {
  return {
    startLocal: `${date}T12:00`,
    endLocal: `${date}T12:30`,
    reason: "meal"
  };
}

function createDraftFromSession(session: OffTraySession): SessionDraft {
  return {
    id: session.id,
    startLocal: toDateTimeLocalValue(new Date(session.startAt)),
    endLocal: session.endAt ? toDateTimeLocalValue(new Date(session.endAt)) : "",
    reason: session.reason ?? "other"
  };
}

function toDateTimeLocalValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatLocalTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatReason(reason: OffTrayReason | null) {
  return reasonOptions.find((option) => option.value === reason)?.label ?? "其他";
}

function formatSessionDuration(session: OffTraySession) {
  if (!session.endAt) {
    return "进行中";
  }

  return formatMinutes((new Date(session.endAt).getTime() - new Date(session.startAt).getTime()) / 60_000);
}
