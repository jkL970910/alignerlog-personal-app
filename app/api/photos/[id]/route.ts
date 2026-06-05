import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { deleteDentalPhotoRecord } from "@/server/repository";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
