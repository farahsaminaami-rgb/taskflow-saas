"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Loader2, MoreHorizontal, Archive, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/client-provider";
import { createClientAction, updateClientAction, archiveClientAction } from "@/actions/client.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { formatDate, initials } from "@/lib/utils";
import type { ClientStatus } from "@prisma/client";

interface ClientRow {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  status: ClientStatus;
  notes: string | null;
  projectCount: number;
  invoiceCount: number;
  createdAt: string;
}

const STATUS_STYLES: Record<ClientStatus, string> = {
  LEAD: "bg-amber-100 text-amber-800",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  INACTIVE: "bg-slate-200 text-slate-700",
  ARCHIVED: "bg-slate-100 text-slate-500",
};

export function ClientsClient({
  workspaceId,
  slug,
  role,
  initialClients,
}: {
  workspaceId: string;
  slug: string;
  role: string;
  initialClients: ClientRow[];
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const canManage = role === "ADMIN" || role === "OWNER" || role === "MEMBER";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialClients.filter((c) => {
      if (status !== "ALL" && c.status !== status) return false;
      if (!q) return true;
      return (
        c.companyName.toLowerCase().includes(q) ||
        (c.contactName ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [initialClients, query, status]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("crm.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("crm.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("crm.searchPlaceholder")}
              className="w-56 pl-8"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("crm.allStatuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("crm.allStatuses")}</SelectItem>
              <SelectItem value="LEAD">{t("client.status.LEAD")}</SelectItem>
              <SelectItem value="ACTIVE">{t("client.status.ACTIVE")}</SelectItem>
              <SelectItem value="INACTIVE">{t("client.status.INACTIVE")}</SelectItem>
            </SelectContent>
          </Select>
          {canManage && <ClientDialog mode="create" workspaceId={workspaceId} onDone={() => router.refresh()} trigger={<Button><Plus className="mr-2 h-4 w-4" />{t("crm.newClient")}</Button>} />}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{t("crm.clientCount", { count: filtered.length })}</p>

      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className="group flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                      {initials(c.companyName)}
                    </span>
                    <div>
                      <p className="font-semibold leading-tight">{c.companyName}</p>
                      {c.contactName && <p className="text-xs text-muted-foreground">{c.contactName}</p>}
                    </div>
                  </div>
                  <Badge className={STATUS_STYLES[c.status]}>{t(`client.status.${c.status}` as never)}</Badge>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {c.email && <span className="truncate">{c.email}</span>}
                  {c.phone && <span dir="ltr">{c.phone}</span>}
                </div>

                <div className="mt-auto flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span className="flex gap-3">
                    <Link href={`/app/workspace/${slug}/invoices`} className="hover:text-foreground">
                      {t("crm.invoices")}: {c.invoiceCount}
                    </Link>
                    <Link href={`/app/workspace/${slug}/projects`} className="hover:text-foreground">
                      {t("crm.projects")}: {c.projectCount}
                    </Link>
                  </span>
                  <span className="flex items-center gap-1">
                    {formatDate(c.createdAt, "MMM d")}
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <ClientDialog
                            mode="edit"
                            workspaceId={workspaceId}
                            client={c}
                            onDone={() => router.refresh()}
                            trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>{t("crm.edit")}</DropdownMenuItem>}
                          />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() =>
                              void archive(workspaceId, c.id, c.status !== "ARCHIVED", () => router.refresh())
                            }
                          >
                            {c.status === "ARCHIVED" ? <RotateCcw className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}
                            {c.status === "ARCHIVED" ? t("crm.unarchive") : t("crm.archive")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">{t("crm.noClients")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

async function archive(workspaceId: string, clientId: string, archived: boolean, refresh: () => void) {
  const r = await archiveClientAction(workspaceId, clientId, archived);
  if (r.ok) {
    toast.success(archived ? "Client archived" : "Client restored");
    refresh();
  } else toast.error(r.error);
}

function ClientDialog({
  mode,
  workspaceId,
  client,
  onDone,
  trigger,
}: {
  mode: "create" | "edit";
  workspaceId: string;
  client?: ClientRow;
  onDone: () => void;
  trigger: React.ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [companyName, setCompanyName] = useState(client?.companyName ?? "");
  const [contactName, setContactName] = useState(client?.contactName ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [website, setWebsite] = useState(client?.website ?? "");
  const [status, setStatus] = useState<string>(client?.status ?? "LEAD");
  const [notes, setNotes] = useState(client?.notes ?? "");

  async function submit() {
    setPending(true);
    try {
      const payload = { companyName: companyName.trim(), contactName: contactName.trim(), email: email.trim(), phone: phone.trim(), website: website.trim(), status, notes };
      const r =
        mode === "create"
          ? await createClientAction(workspaceId, payload)
          : await updateClientAction(workspaceId, client!.id, payload);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(mode === "create" ? "Client created" : "Client updated");
      setOpen(false);
      onDone();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div onClick={(e) => { e.stopPropagation(); setOpen(true); }}>{trigger}</div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? t("crm.newClient") : t("crm.edit")}</DialogTitle>
            <DialogDescription>{t("crm.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("crm.companyName")}</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Inc" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("crm.contactName")}</Label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("crm.status")}</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LEAD">{t("client.status.LEAD")}</SelectItem>
                    <SelectItem value="ACTIVE">{t("client.status.ACTIVE")}</SelectItem>
                    <SelectItem value="INACTIVE">{t("client.status.INACTIVE")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("crm.email")}</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("crm.phone")}</Label>
                <Input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("crm.website")}</Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("crm.notes")}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("crm.cancel")}</Button>
            <Button onClick={() => void submit()} disabled={pending || !companyName.trim()}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("crm.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
