"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { KanbanBoardView } from "@/components/board/kanban-board";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface ProjectOption {
  id: string;
  name: string;
  key: string;
  color: string;
}

export function BoardPageClient({
  workspaceId,
  slug,
  role,
  projects,
  initialProjectId,
}: {
  workspaceId: string;
  slug: string;
  role: string;
  projects: ProjectOption[];
  initialProjectId: string | null;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);

  React.useEffect(() => {
    setProjectId(initialProjectId);
  }, [initialProjectId]);

  if (!projectId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <FolderKanban className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">No projects yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create a project to start working on a board.</p>
        </div>
        <Button asChild>
          <Link href={`/app/workspace/${slug}/projects`}>Create a project</Link>
        </Button>
      </div>
    );
  }

  const current = projects.find((p) => p.id === projectId);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Board toolbar */}
      <div className="flex items-center justify-between gap-3 border-b bg-background px-6 py-2.5">
        <div className="flex items-center gap-2">
          {projects.length > 1 ? (
            <Select
              value={projectId}
              onValueChange={(v) => {
                setProjectId(v);
                router.replace(`/app/workspace/${slug}/board?project=${v}`, { scroll: false });
              }}
            >
              <SelectTrigger className="h-8 w-56 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name} · {p.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: current?.color }} />
              {current?.name}
              <span className="text-muted-foreground">· {current?.key}</span>
            </div>
          )}
        </div>
        {role === "VIEWER" && (
          <span className="text-xs text-muted-foreground">Read-only · contact an admin to edit</span>
        )}
      </div>

      {projectId ? (
        <KanbanBoardView workspaceId={workspaceId} projectId={projectId} />
      ) : null}
    </div>
  );
}