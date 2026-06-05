import { z } from "zod";

import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { deleteDailyNote, updateDailyNote } from "@/server/repository";

export const runtime = "nodejs";

const noteSchema = z.object({
  note: z.string().max(2000)
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const userId = await requireCurrentUserId();
    const { id } = await context.params;
    const parsed = noteSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return apiJson({ error: "Invalid note payload." }, { status: 400 });
    }

    const note = await updateDailyNote(userId, id, parsed.data.note.trim());

    return apiJson({ note });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const userId = await requireCurrentUserId();
    const { id } = await context.params;
    const note = await deleteDailyNote(userId, id);

    return apiJson({ note });
  } catch (error) {
    return apiError(error);
  }
}
