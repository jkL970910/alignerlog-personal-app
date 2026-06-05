import { z } from "zod";

import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { createDentalPhotoRecord, listDentalPhotoRecords } from "@/server/repository";

export const runtime = "nodejs";

const dataUrlPattern = /^data:image\/(jpeg|png|webp);base64,/;
const maxImageBytes = 650_000;
const maxDataUrlLength = 900_000;

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  stageName: z.string().max(80).optional(),
  trayNumber: z.number().int().positive().max(999).nullable().optional(),
  viewType: z.enum(["front", "upper", "lower", "left", "right", "bite", "other"]),
  note: z.string().max(1000).optional(),
  imageDataUrl: z.string().max(maxDataUrlLength).regex(dataUrlPattern),
  imageMimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  imageSizeBytes: z.number().int().positive().max(maxImageBytes)
});

export async function GET() {
  try {
    const userId = await requireCurrentUserId();
    const photos = await listDentalPhotoRecords(userId);

    return apiJson({ photos });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const parsed = createSchema.parse(await request.json());
    const photo = await createDentalPhotoRecord({
      userId,
      ...parsed
    });

    return apiJson({ photo });
  } catch (error) {
    return apiError(error);
  }
}
