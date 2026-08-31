"use client";

import * as React from "react";
import { useState } from "react";
import { Loader2, Save, Ban } from "lucide-react";
import { toast } from "sonner";
import { updateWorkspaceAction } from "@/actions/workspace.actions";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export function SettingsClient({
  workspaceId,
  role,
  workspace,
}: {
  workspaceId: string;
  role: string;
  workspace: { id: string; name: string; slug: string; description: string | null; logoUrl: string | null; plan: string; createdAt: Date };
}) {
  const router = useRouter();
  const canManage = role === "ADMIN" || role === "OWNER";

  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [description, setDescription] = useState(workspace.description ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const r = await updateWorkspaceAction(workspaceId, { name: name.trim(), slug: slug.trim(), description });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Workspace updated");
      if (r.data.slug !== workspace.slug) {
        router.replace(`/app/workspace/${r.data.slug}/settings`);
      } else {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">Workspace profile and configuration.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Workspace profile</CardTitle>
          <CardDescription>
            {canManage ? "Update how this workspace appears to your team." : "View workspace settings."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">
              {(workspace.name ?? "W")[0]?.toUpperCase()}
            </div>
            <div className="text-xs text-muted-foreground">
              <Badge variant="secondary" className="uppercase">{workspace.plan}</Badge>
              <p className="mt-1">Created {formatDate(workspace.createdAt, "MMM d, yyyy")}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Workspace name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Slug</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} disabled={!canManage} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={!canManage}
              placeholder="What does your team work on?"
            />
          </div>

          {canManage && (
            <div className="flex justify-end">
              <Button onClick={() => void save()} disabled={saving || !name.trim() || !slug.trim()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save changes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {!canManage && (
        <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <Ban className="h-4 w-4 shrink-0" />
          You have {role.toLowerCase()} access — only admins can change workspace settings.
        </div>
      )}
    </div>
  );
}