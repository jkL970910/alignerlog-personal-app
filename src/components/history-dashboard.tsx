"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2 } from "lucide-react";

import { formatMinutes, formatPercent } from "@/lib/format";
import { timeZoneHeaders } from "@/lib/client-time-zone";
import type { DailySummary, OffTrayReason, OffTraySession } from "@/lib/types";

import { MetricCard } from "./metric-card";
import { PhotoRecordsDashboard } from "./photo-records-dashboard";
import { SetupWarning } from "./setup-warning";

type Metrics = {
  sevenDayAverage: number;
  thirtyDayAverage: number;
  goalAchievementRate: number;
  longestGoalStreak: number;
  averageOffTrayDuration: number;
  longestOffTraySession: number;
};

type HistoryPayload = {
  summaries: DailySummary[];
  metrics: Metrics;
  today: string;
};

type SessionDraft = {
  id?: string;
  startLocal: string;
  endLocal: string;
  reason: OffTrayReason;
};

const reasonOptions: Array<{ value: OffTrayReason; label: string }> = [
  { value: "meal", label: "进食" },
  { value: "drink", label: "饮品" },
  { value: "brushing", label: "刷牙" },
  { value: "other", label: "其他" }
];

export function HistoryDashboard() {
  const [data, setData] = useState<HistoryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sessions, setSessions] = useState<OffTraySession[]>([]);
  const [sessionDraft, setSessionDraft] = useState<SessionDraft>(() => createEmptyDraft());
  const [sessionPending, setSessionPending] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  async function loadHistory() {
    const response = await fetch("/api/summaries", { headers: timeZoneHeaders() });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "无法载入历史趋势。");
    }

    setData(payload);
  }

  useEffect(() => {
    loadHistory().catch((err: Error) => setError(err.message));
  }, []);

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

  if (error) {
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
  const chartData = recordedSummaries.slice(-14).map((summary) => ({
    date: summary.date.slice(5),
    hours: Number((summary.wearMinutes / 60).toFixed(1)),
    inProgress: summary.date === data.today
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="7日均值" value={formatMinutes(data.metrics.sevenDayAverage)} />
        <MetricCard label="30日均值" value={formatMinutes(data.metrics.thirtyDayAverage)} />
        <MetricCard label="达标率" value={formatPercent(data.metrics.goalAchievementRate)} />
        <MetricCard label="连续达标" value={`${data.metrics.longestGoalStreak}天`} />
      </div>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-ink">最近14天</h2>
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
        {recordedSummaries.slice(-10).reverse().map((summary) => (
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
                <PhotoRecordsDashboard
                  compact
                  embeddedDate={summary.date}
                  helper="给这一天补传阶段照片，适合复盘某次换期或取下记录附近的牙齿状态。"
                  title="补传当天阶段照片"
                />
              </div>
            ) : null}
          </div>
        ))}
        {!recordedSummaries.length ? (
          <div className="rounded-md border border-ink/10 bg-white/80 p-3 text-sm text-ink/60">
            还没有可回看的佩戴记录。
          </div>
        ) : null}
      </section>
    </div>
  );
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
