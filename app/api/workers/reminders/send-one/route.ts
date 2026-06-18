import { z } from "zod";

import { apiError, apiJson } from "@/server/http";
import { deliverOffTrayReminderForSession } from "@/server/reminder-delivery";
import { requireWorkerSecret } from "@/server/worker-auth";

export const runtime = "nodejs";

const sendOneSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  dueAt: z.string().datetime().optional()
});

export async function POST(request: Request) {
  try {
    requireWorkerSecret(request);

    const parsed = sendOneSchema.parse(await request.json());
    const result = await deliverOffTrayReminderForSession({
      userId: parsed.userId,
      sessionId: parsed.sessionId
    });

    return apiJson({ ok: true, result });
  } catch (error) {
    return apiError(error);
  }
}

