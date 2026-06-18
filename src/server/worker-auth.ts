export function requireWorkerSecret(request: Request) {
  const expected = process.env.REMINDER_WORKER_SECRET;
  const actual = request.headers.get("x-worker-secret");
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (cronSecret && authorization === `Bearer ${cronSecret}`) {
    return;
  }

  if (!expected || expected.length < 16) {
    throw new Error("REMINDER_WORKER_SECRET is not configured.");
  }

  if (actual !== expected) {
    throw new Error("Unauthorized.");
  }
}

