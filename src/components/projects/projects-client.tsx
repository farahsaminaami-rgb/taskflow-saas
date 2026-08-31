"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FolderKanban, Plus, Loader2, Archive, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { listProjectsAction, createProjectAction, archiveProjectAction } from "@/actions/project.actions";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils";

interface ProjectRow {
  id: string;
  name: string;
  key: string;
  color: string;
  description: string | null;
  taskCount: number;
  columns: Array<{ id: string; name: string }>;
  createdAt: Date;
}

export function ProjectsClient({
  workspaceId,
  slug,
  role,
  initialProjects,
}: {
  workspaceId: string;
  slug: string;
  role: string;
  initialProjects: ProjectRow[];
}) {
  const router = useRouter();
  const canManage = role === "ADMIN" || role === "OWNER" || role === "MEMBER";

  const { data: projects } = useQuery<ProjectRow[]>({
    queryKey: ["projects", workspaceId],
    queryFn: async () => {
      const rows = await listProjectsAction(workspaceId);
      return rows.map((p) => ({
        id: p.id,
        name: p.name,
        key: p.key,
        color: p.color,
        description: p.description,
        taskCount: p._count.tasks,
        columns: [],
        createdAt: p.createdAt,
      }));
    },
    initialData: initialProjects,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Projects</h2>
          <p className="text-sm text-muted-foreground">
            {projects?.length ?? 0} active · each project has its own board, tags and columns.
          </p>
        </div>
        {canManage && <CreateProjectDialog workspaceId={workspaceId} slug={slug} onCreated={() => router.refresh()} />}
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id} className="group relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{ backgroundColor: p.color }}
                    >
                      {(p.key ?? "PRJ").slice(0, 3).toUpperCase()}
                    </span>
                    <div>
                      <CardTitle className="text-sm">{p.name}</CardTitle>
                      <CardDescription className="text-xs">{p.key}</CardDescription>
                    </div>
                  </div>
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/app/workspace/${slug}/board?project=${p.id}`}>Open board</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => void archive(workspaceId, p.id)}
                        >
                          <Archive className="mr-2 h-4 w-4" /> Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
                <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
                  {p.description || "No description yet."}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{p.taskCount} tasks</span>
                  <span>{formatDate(p.createdAt, "MMM d, yyyy")}</span>
                </div>
                {p.columns.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {p.columns.slice(0, 4).map((c) => (
                      <Badge key={c.id} variant="secondary" className="text-[10px]">
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                )}
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={`/app/workspace/${slug}/board?project=${p.id}`}>Open board</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-16 text-center">
          <FolderKanban className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">No projects yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Create your first project to set up columns and tasks.</p>
          </div>
          {canManage && <CreateProjectDialog workspaceId={workspaceId} slug={slug} onCreated={() => router.refresh()} />}
        </div>
      )}
    </div>
  );
}

async function archive(workspaceId: string, projectId: string) {
  const r = await archiveProjectAction(workspaceId, projectId, true);
  if (r.ok) toast.success("Project archived");
  else toast.error(r.error);
}

function CreateProjectDialog({
  workspaceId,
  slug,
  onCreated,
}: {
  workspaceId: string;
  slug: string;
  onCreated: () => void;
}) {
  const { workspaceId: ws } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");

  const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f43f5e"];

  async function submit() {
    setPending(true);
    try {
      const r = await createProjectAction(workspaceId, { name: name.trim(), key: key.trim(), description, color });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Project created");
      setOpen(false);
      setName("");
      setKey("");
      setDescription("");
      onCreated();
      window.location.href = `/app/workspace/${slug}/board?project=${r.data.id}`;
    } finally {
      setPending(false);
    }
  }

  void ws;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> New project
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a project</DialogTitle>
            <DialogDescription>Projects group columns, tags and tasks on their own board.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Design system" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Key</Label>
                <Input
                  value={key}
                  onChange={(e) => setKey(e.target.value.toUpperCase())}
                  placeholder="DS"
                  maxLength={8}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project about?"
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-6 w-6 rounded-full transition-transform ${color === c ? "ring-2 ring-offset-2 ring-ring scale-110" : "hover:scale-110"}`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void submit()} disabled={pending || !name.trim() || !key.trim()}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}