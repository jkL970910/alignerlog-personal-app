import { z } from "zod";

import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { upsertDailyNote } from "@/server/repository";

export const runtime = "nodejs";

const noteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  note: z.string().max(2000)
});

export async function PATCH(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const parsed = noteSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return apiJson({ error: "Invalid note payload." }, { status: 400 });
    }

    const note = await upsertDailyNote(userId, parsed.data.date, parsed.data.note.trim());

    return apiJson({ note });
  } catch (error) {
    return apiError(error);
  }
}
