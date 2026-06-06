import { z } from "zod";

import { askLooDentalMinister } from "@/server/loo-dental-minister";
import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { appendLooDentalMinisterChatTurn } from "@/server/repository";
import { getRequestTimeZone } from "@/server/time-zone";

export const runtime = "nodejs";

const chatSchema = z.object({
  question: z.string().trim().min(1).max(1200),
  sessionId: z.string().uuid().nullable().optional()
});

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const timeZone = getRequestTimeZone(request);
    const parsed = chatSchema.parse(await request.json());
    const result = await askLooDentalMinister({
      userId,
      question: parsed.question,
      timeZone
    });
    const saved = await appendLooDentalMinisterChatTurn({
      userId,
      sessionId: parsed.sessionId,
      question: parsed.question,
      answer: result.answer
    });

    return apiJson({ ...result, session: saved.session, messages: saved.messages });
  } catch (error) {
    return apiError(error);
  }
}
