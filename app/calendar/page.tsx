import { addDays, format, startOfMonth, startOfWeek } from "date-fns";

import { PageHeader } from "@/components/page-header";

export default function CalendarPage() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: 35 }, (_, index) => addDays(gridStart, index));

  return (
    <>
      <PageHeader
        eyebrow="Month view"
        title={format(now, "MMMM yyyy")}
        subtitle="Calendar color coding will use the same cloud summaries as History."
      />
      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink/50">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <div className="py-2" key={`${day}-${index}`}>{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const isCurrentMonth = day.getMonth() === now.getMonth();
            const isToday = format(day, "yyyy-MM-dd") === format(now, "yyyy-MM-dd");

            return (
              <div
                className={`flex aspect-square items-center justify-center rounded-md border text-sm ${
                  isToday
                    ? "border-mint bg-mint text-white"
                    : isCurrentMonth
                      ? "border-ink/10 bg-mist/60 text-ink"
                      : "border-transparent bg-transparent text-ink/25"
                }`}
                key={day.toISOString()}
              >
                {format(day, "d")}
              </div>
            );
          })}
        </div>
      </section>
      <p className="mt-4 rounded-md border border-ink/10 bg-mist/70 p-3 text-sm leading-6 text-ink/60">
        Next implementation step: fetch monthly summaries, apply green/yellow/red status, and add daily notes.
      </p>
    </>
  );
}
