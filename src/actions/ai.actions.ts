"use server";

import { requireSession } from "@/lib/auth-gate";
import { aiService, getAIConfig } from "@/services/ai.service";
import { ActionResult, fail, ok } from "@/lib/validators";

export async function getAIConfigAction() {
  await requireSession();
  return getAIConfig();
}

export async function askAIAction(
  workspaceId: string,
  input: { conversationId?: string; message: string }
): Promise<ActionResult<{ conversationId: string; conversation: { id: string; role: string; content: string; createdAt: string } }>> {
  try {
    const session = await requireSession();
    const result = await aiService.ask(workspaceId, session.user.id, input);
    return ok({
      conversationId: result.conversationId,
      conversation: {
        id: result.conversation.id,
        role: result.conversation.role,
        content: result.conversation.content,
        createdAt: result.conversation.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to get a response from the AI assistant.");
  }
}

export async function getConversationMessagesAction(workspaceId: string, conversationId: string) {
  const session = await requireSession();
  const messages = await aiService.getMessages(workspaceId, session.user.id, conversationId);
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function listConversationsAction(workspaceId: string) {
  const session = await requireSession();
  return aiService.listConversations(workspaceId, session.user.id);
}
