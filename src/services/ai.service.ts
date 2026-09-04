import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth-gate";
import { env, isDev } from "@/lib/env";
import { workspaceService } from "./workspace.service";
import { dispatchEvent } from "@/lib/realtime/dispatch";

/**
 * AI assistant — thin OpenAI-compatible HTTP abstraction. No SDK dependency so
 * it works with any OpenAI-compatible endpoint (OpenAI, Azure, Together, local
 * LLM proxies, etc.). When no AI_API_KEY is configured the assistant exposes a
 * deterministic "setup required" configuration state instead of erroring.
 */

export interface AIConfigState {
  configured: boolean;
  baseUrl: string | null;
  model: string | null;
}

export function getAIConfig(): AIConfigState {
  return {
    configured: !!env.AI_API_KEY,
    baseUrl: env.AI_BASE_URL ?? "https://api.openai.com/v1",
    model: env.AI_MODEL ?? (env.AI_API_KEY ? "gpt-4o-mini" : null),
  };
}

export interface AIAskInput {
  conversationId?: string;
  message: string;
}

export class AIService {
  private async assertMember(workspaceId: string, userId: string) {
    const m = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!m || m.status !== "ACTIVE") throw new AuthError("You are not a member of this workspace.", 403);
    return m;
  }

  /** Build a tenant-scoped system prompt enriched with workspace context. */
  private async systemPrompt(workspaceId: string): Promise<string> {
    const [workspace, projects, tasks, clients, invoices] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true, plan: true } }),
      prisma.project.findMany({
        where: { workspaceId, isArchived: false },
        select: { id: true, name: true },
        take: 50,
      }),
      prisma.task.findMany({
        where: { workspaceId, isArchived: false },
        select: { id: true, title: true, completedAt: true, priority: true },
        take: 100,
      }),
      prisma.client.findMany({
        where: { workspaceId, status: { not: "ARCHIVED" } },
        select: { id: true, companyName: true, status: true },
        take: 100,
      }),
      prisma.invoice.findMany({
        where: { workspaceId },
        select: { id: true, number: true, status: true, total: true },
        take: 100,
      }),
    ]);

    const summary = {
      workspace: workspace?.name ?? "unknown",
      plan: workspace?.plan ?? "FREE",
      projects: projects.map((p) => p.name),
      openTasks: tasks.filter((t) => !t.completedAt).length,
      totalTasks: tasks.length,
      clients: clients.length,
      clientsById: Object.fromEntries(clients.map((c) => [c.companyName, c.status])),
      invoices: invoices.length,
      invoiceTotals: Object.fromEntries(
        invoices
          .filter((i) => i.status === "PAID" || i.status === "SENT" || i.status === "OVERDUE")
          .map((i) => [i.number, i.total])
      ),
    };

    return [
      "You are the AI assistant for a multi-tenant business management SaaS (TaskFlow).",
      "You help the user manage their CRM clients, invoices, projects and tasks.",
      `Current workspace: "${summary.workspace}" (plan: ${summary.plan}).`,
      `Projects: ${summary.projects.join(", ") || "none"}.`,
      `Open tasks: ${summary.openTasks} of ${summary.totalTasks}.`,
      `Clients (${summary.clients}): ${Object.keys(summary.clientsById).join(", ") || "none"}.`,
      "Answer helpfully and concisely. Never share data across tenants.",
    ].join("\n");
  }

  private async getConversation(workspaceId: string, userId: string, conversationId?: string) {
    if (conversationId) {
      const conv = await prisma.aIConversation.findFirst({
        where: { id: conversationId, workspaceId, userId },
      });
      if (!conv) throw new AuthError("Conversation not found.", 404);
      return conv;
    }
    return prisma.aIConversation.create({ data: { workspaceId, userId } });
  }

  async listConversations(workspaceId: string, userId: string) {
    await this.assertMember(workspaceId, userId);
    return prisma.aIConversation.findMany({
      where: { workspaceId, userId },
      select: {
        id: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 25,
    });
  }

  async getMessages(workspaceId: string, userId: string, conversationId: string) {
    await this.assertMember(workspaceId, userId);
    const conv = await this.getConversation(workspaceId, userId, conversationId);
    return prisma.aIMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Run a full assistant turn. Writes the user message + assistant reply into
   * the (auto-created) conversation so history is preserved and tenant-scoped.
   */
  async ask(workspaceId: string, userId: string, input: AIAskInput) {
    const member = await this.assertMember(workspaceId, userId);
    const config = getAIConfig();

    if (!config.configured) {
      throw new AIUnconfiguredError(
        "AI assistant is not configured. Set AI_API_KEY (and optionally AI_BASE_URL, AI_MODEL) to enable it."
      );
    }

    const conversation = await this.getConversation(workspaceId, userId, input.conversationId);

    const history = await prisma.aIMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { role: true, content: true },
    });

    await prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: input.message,
      },
    });

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: await this.systemPrompt(workspaceId) },
      ...history.map((h) => ({ role: h.role === "USER" ? ("user" as const) : ("assistant" as const), content: h.content })),
      { role: "user", content: input.message },
    ];

    const reply = await this.callLLM(config, messages);

    const assistantMessage = await prisma.aIMessage.create({
      data: { conversationId: conversation.id, role: "ASSISTANT", content: reply },
    });

    await prisma.aIConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    await workspaceService.logActivity(workspaceId, userId, "ai.asked", "ai", conversation.id, {});
    await dispatchEvent({
      type: "ai.created",
      workspaceId,
      actorId: userId,
      data: { conversationId: conversation.id, message: assistantMessage, actorId: member.userId },
    });

    return { conversationId: conversation.id, conversation: assistantMessage };
  }

  private async callLLM(
    config: AIConfigState,
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  ): Promise<string> {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.4,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (isDev) console.error("[ai] LLM error", res.status, detail.slice(0, 500));
      throw new AuthError(`AI request failed (${res.status}).`, 502);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) throw new AuthError("AI returned an empty response.", 502);
    return content;
  }
}

export class AIUnconfiguredError extends AuthError {
  constructor(message: string) {
    super(message, 503);
    this.name = "AIUnconfiguredError";
  }
}

export const aiService = new AIService();
