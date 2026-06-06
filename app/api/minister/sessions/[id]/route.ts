import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { getLooDentalMinisterChatSession, listLooDentalMinisterChatMessages } from "@/server/repository";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireCurrentUserId();
    const { id } = await context.params;
    const session = await getLooDentalMinisterChatSession(userId, id);

    if (!session) {
      throw new Error("找不到这段对话。");
    }

    const messages = await listLooDentalMinisterChatMessages(userId, id);

    return apiJson({ session, messages });
  } catch (error) {
    return apiError(error);
  }
}
