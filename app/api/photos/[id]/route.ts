import { z } from "zod";

import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { deleteDentalPhotoRecord, updateDentalPhotoRecord } from "@/server/repository";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  stageName: z.string().max(80).optional(),
  trayNumber: z.number().int().positive().max(999).nullable().optional(),
  viewType: z.enum(["front", "upper", "lower", "left", "right", "bite", "other"]),
  note: z.string().max(1000).optional()
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const userId = await requireCurrentUserId();
    const { id } = await context.params;
    const parsed = updateSchema.parse(await request.json());
    const photo = await updateDentalPhotoRecord({
      userId,
      photoId: id,
      ...parsed
    });

    return apiJson({ photo });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const userId = await requireCurrentUserId();
    const { id } = await context.params;
    const photo = await deleteDentalPhotoRecord(userId, id);

    return apiJson({ photo });
  } catch (error) {
    return apiError(error);
  }
}
