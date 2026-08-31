"use client";

import * as React from "react";
import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { addCommentAction } from "@/actions/notifications.actions";
import { cn, formatDateTime, initials } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { TaskDetailData } from "@/components/task/task-detail";

export interface CommentShape {
  id: string;
  body: string;
  createdAt: string | Date;
  editedAt: string | Date | null;
  author: { id: string; name: string | null; image: string | null };
}

export function TaskComments({
  workspaceId,
  taskId,
  comments,
  onChanged,
}: {
  workspaceId: string;
  taskId: string;
  comments: TaskDetailData["comments"];
  onChanged: () => void;
}) {
  const { data: session } = useSession();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!body.trim()) return;
    setPending(true);
    try {
      const r = await addCommentAction(workspaceId, { taskId, body: body.trim() });
      if (!r.ok) throw new Error(r.error);
      setBody("");
      toast.success("Comment added");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add comment.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Avatar className="h-7 w-7">
          {session?.user?.image ? <AvatarImage src={session.user.image} /> : null}
          <AvatarFallback className="text-[10px]">{initials(session?.user?.name, "Y")}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a comment… (mentions @name)"
            rows={2}
            className="resize-none text-sm"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => void submit()} disabled={pending || !body.trim()}>
              {pending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-2 h-3.5 w-3.5" />}
              Comment
            </Button>
          </div>
        </div>
      </div>

      <ul className="space-y-4">
        {comments.map((c) => (
          <li key={c.id} className="flex gap-3">
            <Avatar className="h-7 w-7">
              {c.author.image ? <AvatarImage src={c.author.image} /> : null}
              <AvatarFallback className="text-[10px]">{initials(c.author.name, "?")}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold">{c.author.name ?? "Unknown"}</span>
                <span className="text-[11px] text-muted-foreground">
                  {formatDateTime(c.createdAt)}
                  {c.editedAt ? " · edited" : ""}
                </span>
              </div>
              <p
                className={cn(
                  "mt-0.5 rounded-lg bg-muted/50 px-3 py-2 text-sm",
                  !c.body && "italic text-muted-foreground"
                )}
              >
                {c.body || "Deleted"}
              </p>
            </div>
          </li>
        ))}
        {comments.length === 0 && (
          <li className="py-6 text-center text-sm text-muted-foreground">No comments yet — start the discussion.</li>
        )}
      </ul>
    </div>
  );
}