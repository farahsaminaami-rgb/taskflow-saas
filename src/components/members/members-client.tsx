"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Link2, Loader2, LogOut, ShieldCheck, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import {
  inviteMemberAction,
  updateMemberRoleAction,
  removeMemberAction,
  createInviteLinkAction,
  leaveWorkspaceAction,
} from "@/actions/member.actions";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { initials, timeAgo } from "@/lib/utils";

interface MemberRow {
  id: string;
  role: string;
  joinedAt: Date;
  user: { id: string; name: string | null; email: string; image: string | null };
}

const ROLE_BADGE: Record<string, string> = {
  OWNER: "default",
  ADMIN: "secondary",
  MEMBER: "outline",
  VIEWER: "outline",
};

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge variant={(ROLE_BADGE[role] as "default" | "secondary" | "outline") ?? "outline"} className="uppercase text-[10px] tracking-wider">
      {role}
    </Badge>
  );
}

export function MembersClient({
  workspaceId,
  role,
  currentUserId,
  initialMembers,
}: {
  workspaceId: string;
  role: string;
  currentUserId: string;
  initialMembers: MemberRow[];
}) {
  const router = useRouter();
  const { name } = useWorkspace();
  const canManage = role === "ADMIN" || role === "OWNER";
  const members = initialMembers;

  async function changeRole(memberId: string, newRole: string) {
    const r = await updateMemberRoleAction(workspaceId, { memberId, role: newRole });
    if (r.ok) {
      toast.success("Role updated");
      router.refresh();
    } else {
      toast.error(r.error);
    }
  }

  async function remove(memberId: string) {
    const r = await removeMemberAction(workspaceId, { memberId });
    if (r.ok) {
      toast.success("Member removed");
      router.refresh();
    } else {
      toast.error(r.error);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Members</h2>
          <p className="text-sm text-muted-foreground">
            {members.length} active members in {name}.
          </p>
        </div>
        {canManage && <InvitePanel workspaceId={workspaceId} onSent={() => router.refresh()} />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Team</CardTitle>
          <CardDescription>Manage roles and access for your workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-accent/50">
              <Avatar className="h-9 w-9">
                {m.user.image ? <AvatarImage src={m.user.image} /> : null}
                <AvatarFallback>{initials(m.user.name, m.user.email[0] ?? "?")}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">
                    {m.user.name ?? "Unknown"}
                    {m.user.id === currentUserId && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                  </p>
                  {m.role === "OWNER" && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {m.user.email} · joined {m.joinedAt ? timeAgo(m.joinedAt) : "…"}
                </p>
              </div>

              {m.user.id === currentUserId ? (
                <RoleBadge role={m.role} />
              ) : canManage && m.role !== "OWNER" ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-xs">
                      <RoleBadge role={m.role} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {["ADMIN", "MEMBER", "VIEWER"].map((r) => (
                      <DropdownMenuItem key={r} onClick={() => void changeRole(m.id, r)}>
                        <span className="uppercase text-[11px] tracking-wide">{r}</span>
                      </DropdownMenuItem>
                    ))}
                    <Separator className="my-1" />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => void remove(m.id)}
                    >
                      Remove from workspace
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : canManage ? (
                <RoleBadge role={m.role} />
              ) : (
                <RoleBadge role={m.role} />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {role !== "OWNER" && <LeaveWorkspace workspaceId={workspaceId} />}
    </div>
  );
}

function InvitePanel({ workspaceId, onSent }: { workspaceId: string; onSent: () => void }) {
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [pending, setPending] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [linkPending, setLinkPending] = useState(false);
  const [copied, setCopied] = useState(false);

  async function send() {
    setPending(true);
    try {
      const r = await inviteMemberAction(workspaceId, { email: email.trim(), role: inviteRole });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Invitation sent to ${r.data.email}`);
      setEmail("");
      onSent();
    } finally {
      setPending(false);
    }
  }

  async function makeLink() {
    setLinkPending(true);
    try {
      const r = await createInviteLinkAction(workspaceId, inviteRole);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setLink(r.data.url);
    } finally {
      setLinkPending(false);
    }
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <div className="grid grid-cols-[1fr_110px] gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@company.com"
            className="h-9"
          />
          <Select value={inviteRole} onValueChange={setInviteRole}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MEMBER">Member</SelectItem>
              <SelectItem value="VIEWER">Viewer</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => void send()} disabled={pending || !email.trim()} className="h-9">
          {pending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Mail className="mr-2 h-3.5 w-3.5" />}
          Invite
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void makeLink()} disabled={linkPending} className="h-8 gap-2">
          {linkPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
          Create invite link
        </Button>
        {link && (
          <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1">
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{link}</span>
            <Button variant="ghost" size="sm" onClick={() => void copy()} className="h-6 px-2">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function LeaveWorkspace({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function leave() {
    setPending(true);
    try {
      const r = await leaveWorkspaceAction(workspaceId);
      if (!r.ok) {
        toast.error(r.error);
        setOpen(false);
        return;
      }
      toast.success("You left the workspace");
      router.push("/app");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex justify-end">
      <Button variant="outline" className="gap-2 text-destructive" onClick={() => setOpen(true)}>
        <LogOut className="h-4 w-4" /> Leave workspace
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave this workspace?</DialogTitle>
            <DialogDescription>
              You will lose access to all projects and tasks in this workspace. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void leave()} disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}