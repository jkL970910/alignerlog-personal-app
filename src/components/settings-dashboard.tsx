"use client";

import { FormEvent, useEffect, useState } from "react";
import { Download, Loader2, Save } from "lucide-react";

import type { ReminderSettings, TreatmentPlan } from "@/lib/types";

import { SetupWarning } from "./setup-warning";

type SettingsPayload = {
  treatmentPlan: TreatmentPlan;
  reminderSettings: ReminderSettings;
};

export function SettingsDashboard() {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then(async (response) => {
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Could not load settings.");
        }

        setSettings(payload);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!settings) {
      return;
    }

    setPending(true);

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save settings.");
      }

      setSettings(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setPending(false);
    }
  }

  if (error) {
    return <SetupWarning message={error} />;
  }

  if (!settings) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-md border border-ink/10 bg-white/75">
        <Loader2 className="h-6 w-6 animate-spin text-sage" />
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={save}>
      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Daily goal</h2>
        <label className="mt-4 block text-sm font-medium text-ink/70" htmlFor="dailyGoalMinutes">
          Goal minutes
        </label>
        <input
          className="mt-2 min-h-12 w-full rounded-md border border-ink/10 bg-paper px-3 text-ink outline-none focus:border-mint"
          id="dailyGoalMinutes"
          inputMode="numeric"
          min={60}
          onChange={(event) => setSettings({
            ...settings,
            treatmentPlan: {
              ...settings.treatmentPlan,
              dailyGoalMinutes: Number(event.target.value)
            }
          })}
          type="number"
          value={settings.treatmentPlan.dailyGoalMinutes}
        />
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Treatment plan</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field
            label="Start date"
            type="date"
            value={settings.treatmentPlan.startDate}
            onChange={(value) => setSettings({
              ...settings,
              treatmentPlan: { ...settings.treatmentPlan, startDate: value }
            })}
          />
          <Field
            label="Current tray"
            type="number"
            value={String(settings.treatmentPlan.currentTrayNumber)}
            onChange={(value) => setSettings({
              ...settings,
              treatmentPlan: { ...settings.treatmentPlan, currentTrayNumber: Number(value) }
            })}
          />
          <Field
            label="Total trays"
            type="number"
            value={String(settings.treatmentPlan.totalTrays ?? "")}
            onChange={(value) => setSettings({
              ...settings,
              treatmentPlan: { ...settings.treatmentPlan, totalTrays: value ? Number(value) : null }
            })}
          />
          <Field
            label="Days per tray"
            type="number"
            value={String(settings.treatmentPlan.daysPerTray)}
            onChange={(value) => setSettings({
              ...settings,
              treatmentPlan: { ...settings.treatmentPlan, daysPerTray: Number(value) }
            })}
          />
        </div>
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Reminders</h2>
        <label className="mt-4 flex items-center justify-between gap-3 text-sm text-ink">
          <span>Meal reminder</span>
          <input
            checked={settings.reminderSettings.enableMealReminder}
            className="h-5 w-5 accent-mint"
            onChange={(event) => setSettings({
              ...settings,
              reminderSettings: {
                ...settings.reminderSettings,
                enableMealReminder: event.target.checked
              }
            })}
            type="checkbox"
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-ink/70" htmlFor="mealReminderMinutes">
          Remind after
        </label>
        <select
          className="mt-2 min-h-12 w-full rounded-md border border-ink/10 bg-paper px-3 text-ink outline-none focus:border-mint"
          id="mealReminderMinutes"
          onChange={(event) => setSettings({
            ...settings,
            reminderSettings: {
              ...settings.reminderSettings,
              mealReminderMinutes: Number(event.target.value)
            }
          })}
          value={settings.reminderSettings.mealReminderMinutes}
        >
          {[30, 45, 60, 90].map((minutes) => (
            <option key={minutes} value={minutes}>{minutes} minutes</option>
          ))}
        </select>
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Export</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <a className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-ink/10 text-sm font-semibold text-ink" href="/api/export/json">
            <Download className="h-4 w-4" />
            JSON
          </a>
          <a className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-ink/10 text-sm font-semibold text-ink" href="/api/export/csv">
            <Download className="h-4 w-4" />
            CSV
          </a>
        </div>
      </section>

      <button
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-ink px-5 text-base font-semibold text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
        Save settings
      </button>
    </form>
  );
}

function Field(props: {
  label: string;
  type: "date" | "number";
  value: string;
  onChange: (value: string) => void;
}) {
  const id = props.label.toLowerCase().replaceAll(" ", "-");

  return (
    <label className="block text-sm font-medium text-ink/70" htmlFor={id}>
      {props.label}
      <input
        className="mt-2 min-h-12 w-full rounded-md border border-ink/10 bg-paper px-3 text-ink outline-none focus:border-mint"
        id={id}
        inputMode={props.type === "number" ? "numeric" : undefined}
        onChange={(event) => props.onChange(event.target.value)}
        type={props.type}
        value={props.value}
      />
    </label>
  );
}
