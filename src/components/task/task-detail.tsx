"use client";

import * as React from "react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  CalendarX,
  CheckCircle2,
  Circle,
  Loader2,
  Paperclip,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { getTaskAction, updateTaskAction, archiveTaskAction, deleteTaskAction } from "@/actions/task.actions";
import { useBoard, tasksOfColumn } from "@/hooks/use-board";
import { cn, formatDate, isOverdue, truncate, initials, formatDuration } from "@/lib/utils";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePicker } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskComments } from "@/components/task/task-comments";
import { TaskTime } from "@/components/task/task-time";

export interface TaskDetailData {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  dueAt: string | Date | null;
  completedAt: string | Date | null;
  createdAt: string | Date;
  columnId: string;
  isArchived: boolean;
  createdById: string;
  project: { id: string; name: string; key: string };
  assignees: Array<{ userId: string; user: { id: string; name: string | null; email: string; image: string | null } }>;
  tags: Array<{ tag: { id: string; name: string; color: string } }>;
  comments: Array<{
    id: string;
    body: string;
    createdAt: string | Date;
    editedAt: string | Date | null;
    author: { id: string; name: string | null; image: string | null };
  }>;
  attachments: Array<{ id: string; name: string; mimeType: string; size: number; url: string }>;
  timeEntries: Array<{ id: string; minutes: number; note: string | null; startedAt: string | Date }>;
}

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export function TaskDetail({
  workspaceId,
  projectId,
  taskId,
  onClose,
}: {
  workspaceId: string;
  projectId: string;
  taskId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { role } = useWorkspace();
  const { board, moveTask } = useBoard(workspaceId, projectId);

  const detailQuery = useQuery({
    queryKey: ["task", workspaceId, taskId],
    queryFn: async () => {
      const r = await getTaskAction(workspaceId, taskId);
      if (!r.ok) throw new Error(r.error);
      return r.data as unknown as TaskDetailData;
    },
  });

  const detail = detailQuery.data;

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [titleFocused, setTitleFocused] = useState(false);
  const [descEditing, setDescEditing] = useState(false);

  React.useEffect(() => {
    if (detail) {
      setTitle(detail.title);
      setDesc(detail.description ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id]);

  if (!detail) {
    return (
      <div className="flex h-64 items-center justify-center">
        {detailQuery.isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <p className="text-sm text-destructive">{detailQuery.error?.message ?? "Task not found."}</p>
        )}
      </div>
    );
  }

  const canEdit = role !== "VIEWER";
  const overdue = detail.dueAt ? isOverdue(detail.dueAt, detail.completedAt ? new Date(detail.completedAt) : null) : false;
  const totalMinutes = detail.timeEntries.reduce((sum, e) => sum + e.minutes, 0);

  /** Optimistic patch of the detail cache only; the board cache settles via SSE. */
  async function patch(partial: Partial<TaskDetailData>) {
    queryClient.setQueryData(["task", workspaceId, taskId], (prev: TaskDetailData | undefined) =>
      prev ? { ...prev, ...partial } : prev
    );
    try {
      const r = await updateTaskAction(workspaceId, taskId, partial);
      if (!r.ok) throw new Error(r.error);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update task.");
      void queryClient.invalidateQueries({ queryKey: ["task", workspaceId, taskId] });
    }
  }

  const saveTitle = () => {
    setTitleFocused(false);
    const next = title.trim();
    if (next && next !== detail.title) void patch({ title: next });
  };

  const saveDesc = () => {
    setDescEditing(false);
    const next = desc.trim();
    if (next !== (detail.description ?? "")) void patch({ description: next || null });
  };

  const moveToColumn = async (columnId: string) => {
    if (columnId === detail.columnId) return;
    const targetTasks = tasksOfColumn(board, columnId);
    queryClient.setQueryData(["task", workspaceId, taskId], (prev: TaskDetailData | undefined) =>
      prev ? { ...prev, columnId } : prev
    );
    try {
      await moveTask({ taskId, toColumnId: columnId, position: targetTasks.length });
    } catch {
      void queryClient.invalidateQueries({ queryKey: ["task", workspaceId, taskId] });
    }
  };

  const toggleComplete = () =>
    void patch({ completedAt: detail.completedAt ? null : new Date().toISOString() });

  const appointeeIds = detail.assignees.map((a) => a.userId);
  const tagIds = detail.tags.map((t) => t.tag.id);

  const setAssignees = (userId: string) => {
    const next = appointeeIds.includes(userId)
      ? appointeeIds.filter((id) => id !== userId)
      : [...appointeeIds, userId];
    void patch({ assignees: next.map((id) => ({ userId: id, user: { id, name: null, email: "", image: null } })) });
  };

  const setTags = (tagId: string) => {
    const next = tagIds.includes(tagId) ? tagIds.filter((id) => id !== tagId) : [...tagIds, tagId];
    void patch({
      tags: next.map((id) => ({ tag: { id, name: "", color: "#94a3b8" } })),
    });
  };

  async function removeTask(permanent: boolean) {
    const r = permanent
      ? await deleteTaskAction(workspaceId, taskId)
      : await archiveTaskAction(workspaceId, taskId);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(permanent ? "Task deleted" : "Task archived");
    onClose();
  }

  return (
    <div className="flex max-h-[80vh] flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b p-5 pb-4">
        <div className="min-w-0 flex-1">
          {detailQuery.isFetching && !detailQuery.isLoading ? (
            <Loader2 className="mb-1 h-3 w-3 animate-spin text-muted-foreground" />
          ) : null}
          <input
            value={title}
            disabled={!canEdit}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => setTitleFocused(true)}
            onBlur={saveTitle}
            className={cn(
              "w-full bg-transparent text-lg font-semibold outline-none transition-colors",
              titleFocused && "rounded-sm ring-1 ring-ring/60",
              detail.completedAt && "line-through text-muted-foreground"
            )}
          />
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
              {detail.project.key}
            </span>
            <span>· Created {formatDate(detail.createdAt)}</span>
            <span>· {detail.comments.length} comments</span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={!canEdit}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => void removeTask(false)}>
              <Archive className="mr-2 h-4 w-4" /> Archive
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => void removeTask(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete permanently
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-5">
          <Button
            variant={detail.completedAt ? "default" : "outline"}
            size="sm"
            disabled={!canEdit}
            onClick={toggleComplete}
            className="mb-4 w-fit gap-2"
          >
            {detail.completedAt ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
            {detail.completedAt ? "Completed" : "Mark complete"}
          </Button>

          <div className="mb-4">
            <Label className="mb-1.5 block text-xs font-medium">Description</Label>
            {descEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setDescEditing(false);
                  }}
                  rows={5}
                  disabled={!canEdit}
                  className="resize-y"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveDesc}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setDesc(desc); setDescEditing(false); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => canEdit && setDescEditing(true)}
                className={cn(
                  "block w-full rounded-md border border-transparent px-3 py-2 text-left text-sm transition-colors",
                  canEdit && "hover:border-border hover:bg-muted/40",
                  !detail.description && "text-muted-foreground/70"
                )}
              >
                {detail.description ? <span className="whitespace-pre-wrap">{detail.description}</span> : "Add a description…"}
              </button>
            )}
          </div>

          <Separator className="mb-4" />

          <Tabs defaultValue="comments">
            <TabsList className="grid w-fit grid-cols-2">
              <TabsTrigger value="comments">Comments</TabsTrigger>
              <TabsTrigger value="time">Time</TabsTrigger>
            </TabsList>
            <TabsContent value="comments">
              <TaskComments
                workspaceId={workspaceId}
                taskId={taskId}
                comments={detail.comments}
                onChanged={() => void detailQuery.refetch()}
              />
            </TabsContent>
            <TabsContent value="time">
              <TaskTime
                workspaceId={workspaceId}
                taskId={taskId}
                entries={detail.timeEntries}
                onChanged={() => void detailQuery.refetch()}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right meta sidebar */}
        <aside className="w-full shrink-0 space-y-5 border-t p-5 md:w-60 md:border-l md:border-t-0">
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select
              value={detail.columnId}
              onValueChange={(v) => void moveToColumn(v)}
              disabled={!canEdit}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Column" />
              </SelectTrigger>
              <SelectContent>
                {board?.columns.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Priority</Label>
            <Select
              value={detail.priority}
              onValueChange={(v) => void patch({ priority: v })}
              disabled={!canEdit}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Done</Label>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{detail.completedAt ? "Completed" : "Open"}</span>
              </div>
            </div>
            <Switch
              checked={!!detail.completedAt}
              onCheckedChange={() => void toggleComplete()}
              disabled={!canEdit}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Due date</Label>
            <DatePicker
              value={detail.dueAt ? new Date(detail.dueAt) : null}
              onChange={(d) => {
                if (d === null) void patch({ dueAt: null });
                else void patch({ dueAt: d.toISOString() });
              }}
              disabled={!canEdit}
              className="h-8 text-xs"
            />
            {detail.dueAt && (
              <p className={cn("flex items-center gap-1 text-[11px]", overdue ? "text-destructive" : "text-muted-foreground")}>
                <CalendarX className="h-3 w-3" />
                {overdue ? "Overdue" : formatDate(detail.dueAt, "MMM d")}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Assignees</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2 text-xs">
                  {appointeeIds.length > 0 ? (
                    <div className="flex -space-x-1">
                      {detail.assignees.slice(0, 3).map((a) => (
                        <Avatar key={a.user.id} className="h-4 w-4 border border-background">
                          {a.user.image ? <AvatarImage src={a.user.image} /> : null}
                          <AvatarFallback className="text-[7px]">{initials(a.user.name, a.user.email[0] ?? "?")[0]}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" />
                  )}
                  {appointeeIds.length} assigned
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <MemberPicker
                  members={(board?.members ?? []) as MemberShape[]}
                  selected={appointeeIds}
                  onToggle={setAssignees}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tags</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2 text-xs">
                  {tagIds.length > 0 ? (
                    <span className="flex flex-wrap gap-1">
                      {detail.tags.map((t) => (
                        <span
                          key={t.tag.id}
                          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: `${t.tag.color}22`, color: t.tag.color }}
                        >
                          {t.tag.name}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">No tags</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <TagPicker
                  tags={(board?.project?.tags as ProjectTag[] | undefined) ?? []}
                  selected={tagIds}
                  onToggle={setTags}
                />
              </PopoverContent>
            </Popover>
          </div>

          <AttachmentsPanel
            taskId={taskId}
            attachments={detail.attachments}
            onChanged={() => void detailQuery.refetch()}
            disabled={!canEdit}
          />

          <p className="text-[11px] text-muted-foreground">
            {totalMinutes > 0 ? `${formatDuration(totalMinutes)} logged` : "No time logged"}
          </p>
        </aside>
      </div>
    </div>
  );
}

interface MemberShape {
  id: string;
  role: string;
  user: { id: string; name: string | null; email: string; image: string | null };
}

function MemberPicker({
  members,
  selected,
  onToggle,
}: {
  members: MemberShape[];
  selected: string[];
  onToggle: (userId: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = members.filter(
    (m) => (m.user.name ?? "").toLowerCase().includes(q.toLowerCase()) || m.user.email.includes(q)
  );
  return (
    <div className="space-y-1">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search members…"
          className="h-8 pl-7 text-xs"
        />
      </div>
      <div className="mt-1 max-h-56 space-y-0.5 overflow-y-auto">
        {filtered.map((m) => {
          const checked = selected.includes(m.user.id);
          return (
            <button
              key={m.user.id}
              onClick={() => onToggle(m.user.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
            >
              <Avatar className="h-5 w-5">
                {m.user.image ? <AvatarImage src={m.user.image} /> : null}
                <AvatarFallback className="text-[8px]">{initials(m.user.name, m.user.email[0])}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate">{m.user.name ?? m.user.email}</span>
              {checked ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
            </button>
          );
        })}
        {filtered.length === 0 && <p className="px-2 py-2 text-[11px] text-muted-foreground">No matches.</p>}
      </div>
    </div>
  );
}

interface ProjectTag { id: string; name: string; color: string }

function TagPicker({
  tags,
  selected,
  onToggle,
}: {
  tags: ProjectTag[];
  selected: string[];
  onToggle: (tagId: string) => void;
}) {
  return (
    <div className="max-h-72 space-y-0.5 overflow-y-auto">
      {tags.map((t) => {
        const checked = selected.includes(t.id);
        return (
          <button
            key={t.id}
            onClick={() => onToggle(t.id)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
            <span className="min-w-0 flex-1 truncate">{t.name}</span>
            {checked ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
          </button>
        );
      })}
      {tags.length === 0 && <p className="px-2 py-2 text-[11px] text-muted-foreground">No tags yet.</p>}
    </div>
  );
}

function AttachmentsPanel({
  taskId,
  attachments,
  onChanged,
  disabled,
}: {
  taskId: string;
  attachments: TaskDetailData["attachments"];
  onChanged: () => void;
  disabled: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function onFilePicked(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("taskId", taskId);
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      toast.success("Uploaded attachment");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Attachments</Label>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          void onFilePicked(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-full justify-start gap-2 text-xs"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
        {uploading ? "Uploading…" : "Attach file"}
      </Button>
      {attachments.length > 0 && (
        <ul className="space-y-1">
          {attachments.map((a) => (
            <li key={a.id}>
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-primary hover:bg-accent"
              >
                <Paperclip className="h-3 w-3 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{truncate(a.name, 40)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default TaskDetail;