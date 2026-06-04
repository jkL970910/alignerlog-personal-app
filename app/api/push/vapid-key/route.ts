import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { getVapidPublicKey } from "@/server/push";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireCurrentUserId();

    return apiJson({ publicKey: getVapidPublicKey() });
  } catch (error) {
    return apiError(error);
  }
}
