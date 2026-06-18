export interface Env {
  REMINDER_QUEUE: Queue<ReminderMessage>;
  REMINDER_WORKER_SECRET: string;
  REMINDER_WORKER_URL?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface Queue<T> {
  send(message: T, options?: { delaySeconds?: number }): Promise<void>;
}

interface MessageBatch<T> {
  messages: Array<{
    body: T;
    ack(): void;
    retry(): void;
  }>;
}

type ReminderMessage = {
  userId: string;
  sessionId: string;
  dueAt: string;
};

const DEFAULT_REMINDER_WORKER_URL =
  "https://alignerlog-personal-app.vercel.app/api/workers/reminders/send-one";

const maxDelaySeconds = 12 * 60 * 60;

async function scheduleReminder(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed.", { status: 405 });
  }

  requireWorkerSecret(request, env);

  const body = await request.json() as Partial<ReminderMessage> & {
    delaySeconds?: number;
  };

  if (!isUuid(body.userId) || !isUuid(body.sessionId) || !body.dueAt) {
    return Response.json({ error: "Invalid reminder payload." }, { status: 400 });
  }

  const dueAt = new Date(body.dueAt);

  if (Number.isNaN(dueAt.getTime())) {
    return Response.json({ error: "Invalid dueAt." }, { status: 400 });
  }

  const computedDelay = Math.ceil((dueAt.getTime() - Date.now()) / 1000);
  const requestedDelay = typeof body.delaySeconds === "number" ? body.delaySeconds : computedDelay;
  const delaySeconds = Math.min(maxDelaySeconds, Math.max(0, Math.ceil(requestedDelay)));

  await env.REMINDER_QUEUE.send({
    userId: body.userId,
    sessionId: body.sessionId,
    dueAt: dueAt.toISOString()
  }, { delaySeconds });

  return Response.json({
    ok: true,
    queued: true,
    userId: body.userId,
    sessionId: body.sessionId,
    dueAt: dueAt.toISOString(),
    delaySeconds
  });
}

async function deliverReminder(message: ReminderMessage, env: Env): Promise<Response> {
  if (!env.REMINDER_WORKER_SECRET) {
    return new Response("Missing REMINDER_WORKER_SECRET", { status: 500 });
  }

  const response = await fetch(env.REMINDER_WORKER_URL || DEFAULT_REMINDER_WORKER_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-worker-secret": env.REMINDER_WORKER_SECRET
    },
    body: JSON.stringify(message)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return new Response(text || "Reminder delivery failed.", { status: response.status });
  }

  return response;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/schedule") {
      return scheduleReminder(request, env);
    }

    if (url.pathname === "/health") {
      return Response.json({ ok: true, mode: "queue-delayed-reminders" });
    }

    return Response.json({
      ok: true,
      message: "Use POST /schedule to enqueue a user/session reminder."
    });
  },

  async queue(batch: MessageBatch<ReminderMessage>, env: Env, _ctx: ExecutionContext): Promise<void> {
    for (const message of batch.messages) {
      try {
        const response = await deliverReminder(message.body, env);

        if (response.ok) {
          message.ack();
        } else {
          message.retry();
        }
      } catch {
        message.retry();
      }
    }
  }
};

function requireWorkerSecret(request: Request, env: Env) {
  const expected = env.REMINDER_WORKER_SECRET;
  const actual = request.headers.get("x-worker-secret");

  if (!expected || expected.length < 16) {
    throw new Error("REMINDER_WORKER_SECRET is not configured.");
  }

  if (actual !== expected) {
    throw new Error("Unauthorized.");
  }
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
