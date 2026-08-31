"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { Loader2, Play, Square, Timer, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  startTimerAction,
  stopTimerAction,
  addManualTimeAction,
} from "@/actions/notifications.actions";
import { formatDuration, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type { TaskDetailData } from "@/components/task/task-detail";

export interface TimeEntryShape {
  id: string;
  minutes: number;
  note: string | null;
  startedAt: string | Date;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function TaskTime({
  workspaceId,
  taskId,
  entries,
  onChanged,
}: {
  workspaceId: string;
  taskId: string;
  entries: TaskDetailData["timeEntries"];
  onChanged: () => void;
}) {
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.getTime()) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const running = !!startedAt;

  async function toggle() {
    if (running) {
      const r = await stopTimerAction(workspaceId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Logged ${formatDuration(r.data.minutes)}`);
      setStartedAt(null);
      setSeconds(0);
      onChanged();
    } else {
      const r = await startTimerAction(workspaceId, { taskId });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setStartedAt(new Date(r.data.startedAt));
      setSeconds(0);
    }
  }

  const h = pad(Math.floor(seconds / 3600));
  const m = pad(Math.floor((seconds % 3600) / 60));
  const s = pad(seconds % 60);

  const total = entries.reduce((sum, e) => sum + e.minutes, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center gap-3">
          <Timer className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-mono text-lg tabular-nums">
              {running ? `${h}:${m}:${s}` : formatDuration(total)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {running ? "Timer running for this task" : `${formatDuration(total)} total`}
            </p>
          </div>
        </div>
        <Button size="sm" variant={running ? "destructive" : "default"} onClick={() => void toggle()}>
          {running ? <Square className="mr-2 h-3.5 w-3.5" /> : <Play className="mr-2 h-3.5 w-3.5" />}
          {running ? "Stop" : "Start timer"}
        </Button>
      </div>

      <ManualTimeEntry
        workspaceId={workspaceId}
        taskId={taskId}
        onAdded={onChanged}
      />

      <Separator />

      <ul className="space-y-2">
        {entries.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{formatDuration(e.minutes)}</p>
              {e.note ? <p className="truncate text-xs text-muted-foreground">{e.note}</p> : null}
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground">{formatDateTime(e.startedAt)}</span>
          </li>
        ))}
        {entries.length === 0 && !running && (
          <li className="py-6 text-center text-sm text-muted-foreground">No time logged yet.</li>
        )}
      </ul>
    </div>
  );
}

function ManualTimeEntry({
  workspaceId,
  taskId,
  onAdded,
}: {
  workspaceId: string;
  taskId: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    const mins = Number(minutes);
    if (!mins || mins <= 0) {
      toast.error("Enter a duration in minutes.");
      return;
    }
    setPending(true);
    try {
      const r = await addManualTimeAction(workspaceId, {
        taskId,
        minutes: Math.round(mins),
        note: note.trim() || undefined,
      });
      if (!r.ok) throw new Error(r.error);
      toast.success("Time logged");
      setMinutes("");
      setNote("");
      setOpen(false);
      onAdded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to log time.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Log time manually
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Minutes</Label>
        <Input
          type="number"
          min={1}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          placeholder="e.g. 45"
          className="h-8"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Note (optional)</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="What did you work on?"
          className="resize-none text-sm"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" onClick={() => void submit()} disabled={pending}>
          {pending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}