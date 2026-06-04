export interface Env {
  REMINDER_WORKER_SECRET: string;
  REMINDER_WORKER_URL?: string;
}

interface ScheduledController {
  scheduledTime: number;
  cron: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

const DEFAULT_REMINDER_WORKER_URL =
  "https://alignerlog-personal-app.vercel.app/api/workers/reminders/run";

async function runReminderWorker(env: Env): Promise<Response> {
  const url = env.REMINDER_WORKER_URL || DEFAULT_REMINDER_WORKER_URL;
  if (!env.REMINDER_WORKER_SECRET) {
    return new Response("Missing REMINDER_WORKER_SECRET", { status: 500 });
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-worker-secret": env.REMINDER_WORKER_SECRET,
    },
  });

  const text = await response.text();
  return new Response(text, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "text/plain",
    },
  });
}

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(runReminderWorker(env));
  },

  async fetch(_request: Request, env: Env): Promise<Response> {
    return runReminderWorker(env);
  },
};
