import { apiError, apiJson } from "@/server/http";
import { sendPush } from "@/server/push";
import {
  getActiveSession,
  listActivePushSubscriptions,
  listDueReminderJobs,
  markPushSubscriptionExpired,
  markPushSubscriptionUsed,
  markReminderJobFailed,
  markReminderJobSent
} from "@/server/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireWorkerSecret(request);

    const jobs = await listDueReminderJobs(25);
    const results = [];

    for (const job of jobs) {
      const activeSession = await getActiveSession(job.userId);

      if (!activeSession || activeSession.id !== job.sessionId) {
        await markReminderJobSent(job.id);
        results.push({ jobId: job.id, status: "skipped_inactive" });
        continue;
      }

      const subscriptions = await listActivePushSubscriptions(job.userId);

      if (!subscriptions.length) {
        await markReminderJobFailed(job.id, "No active push subscriptions.");
        results.push({ jobId: job.id, status: "failed_no_subscription" });
        continue;
      }

      let sent = 0;
      let lastError = "";

      for (const subscription of subscriptions) {
        try {
          await sendPush(subscription, {
            title: "Loo牙管理器",
            body: "牙套已经取下一段时间了。若已经吃完或刷牙完成，请记得戴回。",
            url: "/today"
          });
          await markPushSubscriptionUsed(subscription.endpoint);
          sent += 1;
        } catch (error) {
          const statusCode = getPushStatusCode(error);

          if (statusCode === 404 || statusCode === 410) {
            await markPushSubscriptionExpired(subscription.endpoint);
          }

          lastError = error instanceof Error ? error.message : "Failed to send push.";
        }
      }

      if (sent > 0) {
        await markReminderJobSent(job.id);
        results.push({ jobId: job.id, status: "sent", sent });
      } else {
        await markReminderJobFailed(job.id, lastError || "No push notification was sent.");
        results.push({ jobId: job.id, status: "failed", error: lastError });
      }
    }

    return apiJson({ ok: true, processed: results.length, results });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: Request) {
  return POST(request);
}

function requireWorkerSecret(request: Request) {
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

function getPushStatusCode(error: unknown) {
  if (typeof error === "object" && error && "statusCode" in error) {
    return Number((error as { statusCode?: unknown }).statusCode);
  }

  return null;
}
