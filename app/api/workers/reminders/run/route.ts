import { apiError, apiJson } from "@/server/http";
import { deliverOffTrayReminderForSession } from "@/server/reminder-delivery";
import {
  listDueReminderJobs,
} from "@/server/repository";
import { requireWorkerSecret } from "@/server/worker-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireWorkerSecret(request);

    const jobs = await listDueReminderJobs(25);
    const results = [];

    for (const job of jobs) {
      results.push(await deliverOffTrayReminderForSession({
        userId: job.userId,
        sessionId: job.sessionId
      }));
    }

    return apiJson({ ok: true, processed: results.length, results });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: Request) {
  return POST(request);
}
