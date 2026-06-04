"use client";

import { useEffect, useMemo, useState } from "react";
import { addMonths, format, isSameMonth, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react";

import { formatMinutes, formatPercent } from "@/lib/format";
import { getClientDateKey, timeZoneHeaders } from "@/lib/client-time-zone";
import type { CalendarDay } from "@/lib/types";

import { SetupWarning } from "./setup-warning";

type CalendarPayload = {
  month: string;
  startDate: string;
  endDate: string;
  days: CalendarDay[];
};

type LoadState =
  | { status: "loading"; data?: never; error?: never }
  | { status: "ready"; data: CalendarPayload; error?: never }
  | { status: "error"; data?: never; error: string };

export function CalendarDashboard() {
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => getClientDateKey());
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const monthKey = format(monthDate, "yyyy-MM");

  useEffect(() => {
    setState({ status: "loading" });
    fetch(`/api/calendar?month=${monthKey}`, { headers: timeZoneHeaders() })
      .then(async (response) => {
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "无法载入佩戴日历。");
        }

        setState({ status: "ready", data: payload });
      })
      .catch((error: Error) => setState({ status: "error", error: error.message }));
  }, [monthKey]);

  const selectedDay = useMemo(() => {
    if (state.status !== "ready") {
      return null;
    }

    return state.data.days.find((day) => day.date === selectedDate) ?? state.data.days[0] ?? null;
  }, [selectedDate, state]);

  useEffect(() => {
    setNoteDraft(selectedDay?.note?.note ?? "");
  }, [selectedDay?.date, selectedDay?.note?.note]);

  async function saveNote() {
    if (!selectedDay || state.status !== "ready") {
      return;
    }

    setSavingNote(true);

    try {
      const response = await fetch("/api/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDay.date, note: noteDraft })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "无法保存日记。");
      }

      setState({
        status: "ready",
        data: {
          ...state.data,
          days: state.data.days.map((day) => (
            day.date === selectedDay.date ? { ...day, note: payload.note } : day
          ))
        }
      });
    } catch (error) {
      setState({ status: "error", error: error instanceof Error ? error.message : "无法保存日记。" });
    } finally {
      setSavingNote(false);
    }
  }

  if (state.status === "error") {
    return <SetupWarning message={state.error} />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            aria-label="上个月"
            className="flex h-10 w-10 items-center justify-center rounded-md border border-ink/10 text-ink"
            onClick={() => setMonthDate((value) => addMonths(value, -1))}
            type="button"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold text-ink">{format(monthDate, "yyyy年M月")}</h2>
          <button
            aria-label="下个月"
            className="flex h-10 w-10 items-center justify-center rounded-md border border-ink/10 text-ink"
            onClick={() => setMonthDate((value) => addMonths(value, 1))}
            type="button"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink/50">
          {["日", "一", "二", "三", "四", "五", "六"].map((day, index) => (
            <div className="py-2" key={`${day}-${index}`}>{day}</div>
          ))}
        </div>

        {state.status === "loading" ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-sage" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {state.data.days.map((day) => {
              const date = parseISO(day.date);
              const currentMonth = isSameMonth(date, monthDate);
              const selected = day.date === selectedDate;
              const statusClass = getDayStatusClass(day);

              return (
                <button
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-md border text-xs transition ${
                    selected ? "border-ink ring-2 ring-ink/10" : "border-transparent"
                  } ${currentMonth ? statusClass : "bg-transparent text-ink/25"}`}
                  key={day.date}
                  onClick={() => setSelectedDate(day.date)}
                  type="button"
                >
                  <span className="font-semibold">{format(date, "d")}</span>
                  {day.note?.note ? <span className="mt-1 h-1.5 w-1.5 rounded-full bg-ink/60" /> : null}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedDay ? (
        <section className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-sage">{selectedDay.date}</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">{getDayStatusLabel(selectedDay)}</h2>
            </div>
            {selectedDay.hasData ? (
              <p className="rounded-md bg-mist px-2 py-1 text-sm font-semibold text-ink">
                {formatPercent(Math.min(100, (selectedDay.summary.wearMinutes / selectedDay.summary.goalMinutes) * 100))}
              </p>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Detail label="已佩戴" value={selectedDay.hasData ? formatMinutes(selectedDay.summary.wearMinutes) : "暂无记录"} />
            <Detail label="取下" value={selectedDay.hasData ? formatMinutes(selectedDay.summary.offMinutes) : "暂无记录"} />
            <Detail label="目标" value={formatMinutes(selectedDay.summary.goalMinutes)} />
            <Detail label="次数" value={String(selectedDay.summary.sessionCount)} />
          </div>

          <label className="mt-4 block text-sm font-medium text-ink/70" htmlFor="daily-note">
            当日札记
            <textarea
              className="mt-2 min-h-28 w-full resize-none rounded-md border border-ink/10 bg-paper px-3 py-2 text-ink outline-none focus:border-mint"
              id="daily-note"
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="记录进食节奏、牙套贴合、酸痛感，或任何值得回看的细节。"
              value={noteDraft}
            />
          </label>
          <button
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={savingNote}
            onClick={saveNote}
            type="button"
          >
            {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存札记
          </button>
        </section>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-mist/70 p-3">
      <p className="text-xs font-medium uppercase text-ink/50">{label}</p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  );
}

function getDayStatusClass(day: CalendarDay) {
  if (day.status === "no_data") {
    return "bg-mist/60 text-ink/55";
  }

  if (day.status === "goal_met") {
    return "bg-mint text-white";
  }

  if (day.status === "close") {
    return "bg-amber/80 text-ink";
  }

  return "bg-coral/80 text-white";
}

function getDayStatusLabel(day: CalendarDay) {
  if (day.status === "no_data") {
    return "暂无佩戴记录";
  }

  if (day.status === "goal_met") {
    return "已达标";
  }

  if (day.status === "close") {
    return "接近达标";
  }

  return "低于目标";
}
