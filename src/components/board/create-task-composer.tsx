"use client";

import * as React from "react";
import { useState } from "react";
import { Loader2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { createTaskAction } from "@/actions/task.actions";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CreateTaskComposer({
  projectId,
  columnId,
  onClose,
}: {
  projectId: string;
  columnId: string;
  onClose: () => void;
}) {
  const { workspaceId } = useWorkspace();
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    ref.current?.focus();
  }, []);

  async function submit() {
    if (!title.trim()) return;
    setPending(true);
    try {
      const result = await createTaskAction(workspaceId, {
        projectId,
        columnId,
        title: title.trim(),
        priority: "MEDIUM",
      });
      if (result.ok) {
        toast.success("Task created");
        setTitle("");
        onClose();
      } else {
        toast.error(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-2 shadow-sm">
      <Textarea
        ref={ref}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
          if (e.key === "Escape") onClose();
        }}
        placeholder="Task title…"
        className="min-h-[40px] resize-none border-0 p-1 shadow-none focus-visible:ring-0"
      />
      <div className="mt-1 flex items-center justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Cancel">
          <X className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" onClick={() => void submit()} disabled={pending || !title.trim()} aria-label="Create task">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}