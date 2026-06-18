import type { ReminderJob } from "@/lib/types";

const DEFAULT_REMINDER_WORKER_SCHEDULE_URL =
  "https://loo-dental-reminder-cron.jkliu97.workers.dev/schedule";

export async function scheduleReminderDelivery(job: ReminderJob) {
  const secret = process.env.REMINDER_WORKER_SECRET;
  const url = process.env.REMINDER_WORKER_SCHEDULE_URL || DEFAULT_REMINDER_WORKER_SCHEDULE_URL;

  if (!secret || secret.length < 16) {
    console.warn("Skipping delayed reminder scheduling: REMINDER_WORKER_SECRET is not configured.");
    return;
  }

  const delaySeconds = Math.max(
    0,
    Math.ceil((new Date(job.dueAt).getTime() - Date.now()) / 1000)
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-worker-secret": secret
    },
    body: JSON.stringify({
      userId: job.userId,
      sessionId: job.sessionId,
      dueAt: job.dueAt,
      delaySeconds
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Delayed reminder schedule failed: ${response.status} ${text}`.trim());
  }
}

