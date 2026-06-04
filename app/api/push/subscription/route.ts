import { z } from "zod";

import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { disablePushSubscription, upsertPushSubscription } from "@/server/repository";

export const runtime = "nodejs";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1)
  })
});

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const parsed = subscriptionSchema.parse(await request.json());
    const subscription = await upsertPushSubscription({
      userId,
      endpoint: parsed.endpoint,
      p256dh: parsed.keys.p256dh,
      auth: parsed.keys.auth,
      userAgent: request.headers.get("user-agent")
    });

    return apiJson({ subscription });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const parsed = z.object({ endpoint: z.string().url() }).parse(await request.json());
    await disablePushSubscription(userId, parsed.endpoint);

    return apiJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
