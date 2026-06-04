"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2 } from "lucide-react";

import { formatMinutes, formatPercent } from "@/lib/format";
import { timeZoneHeaders } from "@/lib/client-time-zone";
import type { DailySummary } from "@/lib/types";

import { MetricCard } from "./metric-card";
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
};

export function HistoryDashboard() {
  const [data, setData] = useState<HistoryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/summaries", { headers: timeZoneHeaders() })
      .then(async (response) => {
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "无法载入历史趋势。");
        }

        setData(payload);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

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
    hours: Number((summary.wearMinutes / 60).toFixed(1))
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
                <Tooltip formatter={(value) => [`${value}小时`, "已佩戴"]} />
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
          <div className="flex items-center justify-between rounded-md border border-ink/10 bg-white/80 p-3" key={summary.date}>
            <div>
              <p className="font-medium text-ink">{summary.date}</p>
              <p className="text-sm text-ink/60">取下 {summary.sessionCount} 次</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-ink">{formatMinutes(summary.wearMinutes)}</p>
              <p className={`text-sm ${summary.goalMet ? "text-mint" : "text-coral"}`}>
                {summary.goalMet ? "已达标" : "未达标"}
              </p>
            </div>
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
