import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { createLooDentalMinisterChatSession, listLooDentalMinisterChatSessions } from "@/server/repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await requireCurrentUserId();
    const sessions = await listLooDentalMinisterChatSessions(userId);

    return apiJson({ sessions });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST() {
  try {
    const userId = await requireCurrentUserId();
    const session = await createLooDentalMinisterChatSession(userId);

    return apiJson({ session, messages: [] });
  } catch (error) {
    return apiError(error);
  }
}
