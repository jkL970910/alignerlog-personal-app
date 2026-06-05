"use client";

import { useEffect, useMemo, useState } from "react";
import { addMonths, format, isSameMonth, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { formatMinutes, formatPercent } from "@/lib/format";
import { getClientDateKey, timeZoneHeaders } from "@/lib/client-time-zone";
import type { CalendarDay, DailyNote } from "@/lib/types";

import { SetupWarning } from "./setup-warning";
import { PhotoRecordsDashboard } from "./photo-records-dashboard";

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

type NoteModalState = {
  mode: "create" | "edit";
  noteId?: string;
  draft: string;
} | null;

export function CalendarDashboard() {
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => getClientDateKey());
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [noteModal, setNoteModal] = useState<NoteModalState>(null);
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

  async function saveNote() {
    if (!selectedDay || state.status !== "ready" || !noteModal) {
      return;
    }

    setSavingNote(true);

    try {
      const response = await fetch(noteModal.mode === "edit" ? `/api/notes/${noteModal.noteId}` : "/api/notes", {
        method: noteModal.mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(noteModal.mode === "edit"
          ? { note: noteModal.draft }
          : { date: selectedDay.date, note: noteModal.draft })
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
            day.date === selectedDay.date ? mergeDayNote(day, payload.note) : day
          ))
        }
      });
      setNoteModal(null);
    } catch (error) {
      setState({ status: "error", error: error instanceof Error ? error.message : "无法保存日记。" });
    } finally {
      setSavingNote(false);
    }
  }

  async function deleteNote(noteId: string) {
    if (!selectedDay || state.status !== "ready") {
      return;
    }

    setSavingNote(true);

    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: "DELETE"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "无法删除札记。");
      }

      setState({
        status: "ready",
        data: {
          ...state.data,
          days: state.data.days.map((day) => (
            day.date === selectedDay.date ? removeDayNote(day, noteId) : day
          ))
        }
      });
    } catch (error) {
      setState({ status: "error", error: error instanceof Error ? error.message : "无法删除札记。" });
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
                  <div className="mt-1 flex items-center gap-1">
                    {day.trayEvents.some((event) => event.kind === "start") ? <span className="h-1.5 w-1.5 rounded-full bg-sage" /> : null}
                    {day.trayEvents.some((event) => event.kind === "end") ? <span className="h-1.5 w-1.5 rounded-full bg-amber" /> : null}
                    {day.note?.note ? <span className="h-1.5 w-1.5 rounded-full bg-ink/60" /> : null}
                  </div>
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

          {selectedDay.trayEvents.length ? (
            <div className="mt-4 rounded-md border border-amber/20 bg-mist/50 p-3">
              <p className="text-xs font-semibold tracking-[0.16em] text-sage">牙套计划</p>
              <div className="mt-2 space-y-2">
                {selectedDay.trayEvents.map((event) => (
                  <div className="flex items-center justify-between rounded-md bg-white/80 px-3 py-2 text-sm" key={`${event.kind}-${event.trayNumber}`}>
                    <span className="font-semibold text-ink">{event.label}</span>
                    <span className="text-xs text-ink/50">{event.kind === "start" ? "开始日" : "结束日"}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 space-y-4">
            <section className="rounded-md border border-ink/10 bg-paper p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-ink">当日札记</h3>
                  <p className="mt-1 text-xs leading-5 text-ink/55">
                    {selectedDay.notes.length ? `${selectedDay.notes.length} 条已保存札记` : "暂无札记"}
                  </p>
                </div>
                <button
                  className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white"
                  onClick={() => setNoteModal({ mode: "create", draft: "" })}
                  type="button"
                >
                  新增札记
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {selectedDay.notes.length ? selectedDay.notes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onDelete={() => deleteNote(note.id)}
                    onEdit={() => setNoteModal({ mode: "edit", noteId: note.id, draft: note.note })}
                    pending={savingNote}
                  />
                )) : (
                  <p className="rounded-md bg-white p-3 text-sm leading-6 text-ink/60">
                    还没有札记。点击“新增札记”后填写，保存后会变成独立卡片。
                  </p>
                )}
              </div>
            </section>

            <section>
              <PhotoRecordsDashboard
                compact
                deferUploadForm
                embeddedDate={selectedDay.date}
                hideCompare
                helper="已保存照片会直接展示；新增照片时再打开表单。建议保持同角度、同光线，方便后续对比。"
                title="阶段照片"
              />
            </section>
          </div>
          {noteModal ? (
            <div className="fixed inset-0 z-40 flex items-end bg-ink/35 p-3 backdrop-blur-sm">
              <div className="w-full rounded-xl bg-white p-4 shadow-2xl">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink">{noteModal.mode === "edit" ? "修改札记" : "新增札记"}</h3>
                    <p className="mt-1 text-xs leading-5 text-ink/55">保存后会显示为当日记录卡片。</p>
                  </div>
                  <button
                    className="rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-ink"
                    onClick={() => setNoteModal(null)}
                    type="button"
                  >
                    关闭
                  </button>
                </div>
                <textarea
                  className="min-h-36 w-full resize-none rounded-md border border-ink/10 bg-paper px-3 py-2 text-ink outline-none focus:border-mint"
                  onChange={(event) => setNoteModal({ ...noteModal, draft: event.target.value })}
                  placeholder="记录进食节奏、牙套贴合、酸痛感，或任何值得回看的细节。"
                  value={noteModal.draft}
                />
                <button
                  className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={savingNote || !noteModal.draft.trim()}
                  onClick={saveNote}
                  type="button"
                >
                  {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {noteModal.mode === "edit" ? "保存修改" : "保存札记"}
                </button>
              </div>
            </div>
          ) : null}
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

function NoteCard(props: {
  note: DailyNote;
  pending: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-md border border-ink/10 bg-white p-3">
      <p className="whitespace-pre-wrap text-sm leading-6 text-ink/75">{props.note.note}</p>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink/45">
        <span>{formatSavedAt(props.note.updatedAt)}</span>
        <div className="flex gap-2">
          <button
            className="rounded-full border border-ink/10 px-3 py-1 font-semibold text-ink"
            disabled={props.pending}
            onClick={props.onEdit}
            type="button"
          >
            修改
          </button>
          <button
            className="rounded-full border border-coral/20 px-3 py-1 font-semibold text-coral"
            disabled={props.pending}
            onClick={props.onDelete}
            type="button"
          >
            删除
          </button>
        </div>
      </div>
    </article>
  );
}

function mergeDayNote(day: CalendarDay, note: DailyNote): CalendarDay {
  const notes = day.notes.some((item) => item.id === note.id)
    ? day.notes.map((item) => item.id === note.id ? note : item)
    : [...day.notes, note];

  return {
    ...day,
    note: notes[0] ?? null,
    notes,
    hasData: true,
    status: day.status === "no_data" ? "below_goal" : day.status
  };
}

function removeDayNote(day: CalendarDay, noteId: string): CalendarDay {
  const notes = day.notes.filter((note) => note.id !== noteId);

  return {
    ...day,
    note: notes[0] ?? null,
    notes,
    hasData: day.summary.hasData || notes.length > 0,
    status: day.summary.hasData ? day.status : notes.length > 0 ? "below_goal" : "no_data"
  };
}

function formatSavedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
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
    return day.note?.note ? "有札记" : "暂无佩戴记录";
  }

  if (day.status === "goal_met") {
    return "已达标";
  }

  if (day.status === "close") {
    return "接近达标";
  }

  return "低于目标";
}
