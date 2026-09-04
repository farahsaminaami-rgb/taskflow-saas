"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, User, AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/client-provider";
import { askAIAction } from "@/actions/ai.actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function AssistantClient({
  workspaceId,
  initialConfig,
}: {
  workspaceId: string;
  initialConfig: { configured: boolean; baseUrl: string | null; model: string | null };
}) {
  const { t } = useI18n();
  const configured = initialConfig.configured;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const suggestions = [t("ai.suggest1"), t("ai.suggest2"), t("ai.suggest3")];

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || pending) return;
    setMessages((prev) => [...prev, { id: `u${Date.now()}`, role: "user", content }]);
    setInput("");
    setPending(true);
    try {
      const r = await askAIAction(workspaceId, { message: content });
      if (!r.ok) {
        setMessages((prev) => [...prev, { id: `a${Date.now()}`, role: "assistant", content: r.error }]);
        return;
      }
      setMessages((prev) => [...prev, { id: r.data.conversation.id, role: "assistant", content: r.data.conversation.content }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col space-y-4 p-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Sparkles className="h-5 w-5 text-primary" />
          {t("ai.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("ai.subtitle")}</p>
      </div>

      {!configured && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("ai.unconfigured")}</span>
        </div>
      )}

      <Card className="flex flex-col">
        <CardContent className="flex flex-col gap-3 p-4">
          <div ref={scrollRef} className="flex max-h-[52vh] min-h-[40vh] flex-col gap-3 overflow-y-auto pr-1">
            {messages.length === 0 && !pending && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                <Bot className="h-10 w-10 text-muted-foreground" />
                <p className="max-w-md text-sm text-muted-foreground">{t("ai.subtitle")}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestions.map((s) => (
                    <Button key={s} variant="outline" size="sm" onClick={() => void send(s)} disabled={!configured}>
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={cn("flex gap-2", m.role === "user" && "flex-row-reverse")}>
                <span className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  m.role === "assistant" ? "bg-primary/10 text-primary" : "bg-muted"
                )}>
                  {m.role === "assistant" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </span>
                <div className={cn(
                  "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  {m.content}
                </div>
              </div>
            ))}

            {pending && (
              <div className="flex gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </span>
                <div className="rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />
                  {t("ai.thinking")}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-end gap-2 border-t pt-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={t("ai.placeholder")}
              rows={1}
              className="min-h-[44px] flex-1 resize-none"
              disabled={!configured}
            />
            <Button onClick={() => void send()} disabled={pending || !input.trim() || !configured} className="h-[44px]">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">{t("ai.send")}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
