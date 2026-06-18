import { sendPush } from "@/server/push";
import {
  getActiveSession,
  getScheduledReminderJobForSession,
  listActivePushSubscriptions,
  markPushSubscriptionExpired,
  markPushSubscriptionUsed,
  markReminderJobFailed,
  markReminderJobSent
} from "@/server/repository";

export type ReminderDeliveryResult = {
  jobId?: string;
  sessionId: string;
  status:
    | "sent"
    | "skipped_inactive"
    | "skipped_not_due"
    | "skipped_not_scheduled"
    | "failed_no_subscription"
    | "failed";
  sent?: number;
  error?: string;
};

export async function deliverOffTrayReminderForSession(params: {
  userId: string;
  sessionId: string;
  now?: Date;
}): Promise<ReminderDeliveryResult> {
  const now = params.now ?? new Date();
  const job = await getScheduledReminderJobForSession(params.userId, params.sessionId);

  if (!job) {
    return {
      sessionId: params.sessionId,
      status: "skipped_not_scheduled"
    };
  }

  if (new Date(job.dueAt).getTime() > now.getTime()) {
    return {
      jobId: job.id,
      sessionId: params.sessionId,
      status: "skipped_not_due"
    };
  }

  const activeSession = await getActiveSession(params.userId);

  if (!activeSession || activeSession.id !== params.sessionId) {
    await markReminderJobSent(job.id);
    return {
      jobId: job.id,
      sessionId: params.sessionId,
      status: "skipped_inactive"
    };
  }

  const subscriptions = await listActivePushSubscriptions(params.userId);

  if (!subscriptions.length) {
    await markReminderJobFailed(job.id, "No active push subscriptions.");
    return {
      jobId: job.id,
      sessionId: params.sessionId,
      status: "failed_no_subscription"
    };
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
    return {
      jobId: job.id,
      sessionId: params.sessionId,
      status: "sent",
      sent
    };
  }

  await markReminderJobFailed(job.id, lastError || "No push notification was sent.");
  return {
    jobId: job.id,
    sessionId: params.sessionId,
    status: "failed",
    error: lastError
  };
}

function getPushStatusCode(error: unknown) {
  if (typeof error === "object" && error && "statusCode" in error) {
    return Number((error as { statusCode?: unknown }).statusCode);
  }

  return null;
}

