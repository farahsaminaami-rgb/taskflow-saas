"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Search, FileText, Pencil, Send, CheckCircle2, Ban, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/client-provider";
import { createInvoiceAction, updateInvoiceAction, sendInvoiceAction, markInvoicePaidAction, cancelInvoiceAction } from "@/actions/invoice.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate, formatMoney } from "@/lib/utils";
import type { InvoiceStatus } from "@prisma/client";

interface InvItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface InvRow {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  projectId: string | null;
  status: InvoiceStatus;
  currency: string;
  issueDate: string;
  dueDate: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  notes: string | null;
  items: InvItem[];
}

interface Option {
  id: string;
  companyName?: string;
  name?: string;
}

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  DRAFT: "bg-slate-200 text-slate-700",
  SENT: "bg-blue-100 text-blue-800",
  PAID: "bg-emerald-100 text-emerald-800",
  PENDING: "bg-amber-100 text-amber-800",
  OVERDUE: "bg-red-100 text-red-800",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export function InvoicesClient({
  workspaceId,
  slug,
  role,
  initialInvoices,
  clients,
  projects,
  summary,
}: {
  workspaceId: string;
  slug: string;
  role: string;
  initialInvoices: InvRow[];
  clients: Option[];
  projects: Option[];
  summary: { outstanding: number; paid: number; overdue: number; count: number };
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [statusFltr, setStatusFltr] = useState<string>("ALL");
  const canManage = role === "ADMIN" || role === "OWNER" || role === "MEMBER";
  const canSend = role === "ADMIN" || role === "OWNER";
  const currency = "USD";
  void slug;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialInvoices.filter((i) => {
      if (statusFltr !== "ALL" && i.status !== statusFltr) return false;
      if (!q) return true;
      return i.number.toLowerCase().includes(q) || i.clientName.toLowerCase().includes(q);
    });
  }, [initialInvoices, query, statusFltr]);

  const pdfHref = (id: string) => `/api/invoices/${id}/pdf?workspaceId=${workspaceId}`;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("inv.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("inv.subtitle")}</p>
        </div>
        {canManage && (
          <InvoiceDialog
            workspaceId={workspaceId}
            clients={clients}
            projects={projects}
            onDone={() => router.refresh()}
            trigger={<Button><Plus className="mr-2 h-4 w-4" />{t("inv.newInvoice")}</Button>}
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label={t("inv.outstanding")} value={formatMoney(summary.outstanding, currency)} tone="default" />
        <Kpi label={t("inv.revenue")} value={formatMoney(summary.paid, currency)} tone="good" />
        <Kpi label={t("inv.overdue")} value={formatMoney(summary.overdue, currency)} tone="danger" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("inv.searchPlaceholder")} className="w-64 pl-8" />
        </div>
        <Select value={statusFltr} onValueChange={setStatusFltr}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("inv.status")}</SelectItem>
            <SelectItem value="DRAFT">{t("inv.status.DRAFT")}</SelectItem>
            <SelectItem value="SENT">{t("inv.status.SENT")}</SelectItem>
            <SelectItem value="PAID">{t("inv.status.PAID")}</SelectItem>
            <SelectItem value="PENDING">{t("inv.status.PENDING")}</SelectItem>
            <SelectItem value="OVERDUE">{t("inv.status.OVERDUE")}</SelectItem>
            <SelectItem value="CANCELLED">{t("inv.status.CANCELLED")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">{t("inv.number")}</th>
                    <th className="px-4 py-3 font-medium">{t("inv.client")}</th>
                    <th className="px-4 py-3 font-medium">{t("inv.issueDate")}</th>
                    <th className="px-4 py-3 font-medium">{t("inv.dueDate")}</th>
                    <th className="px-4 py-3 text-right font-medium">{t("inv.total")}</th>
                    <th className="px-4 py-3 font-medium">{t("inv.status")}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">{inv.number}</td>
                      <td className="px-4 py-3">{inv.clientName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.issueDate, "MMM d, yyyy")}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {inv.dueDate ? formatDate(inv.dueDate, "MMM d, yyyy") : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{formatMoney(inv.total, currency)}</td>
                      <td className="px-4 py-3"><Badge className={STATUS_STYLES[inv.status]}>{t(`inv.status.${inv.status}` as never)}</Badge></td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>{inv.number}</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                              <a href={pdfHref(inv.id)} target="_blank" rel="noreferrer"><Eye className="mr-2 h-4 w-4" />{t("inv.viewPdf")}</a>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={pdfHref(inv.id)} download><Download className="mr-2 h-4 w-4" />{t("inv.downloadPdf")}</a>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {canManage && (
                              <InvoiceDialog
                                workspaceId={workspaceId}
                                invoice={inv}
                                clients={clients}
                                projects={projects}
                                onDone={() => router.refresh()}
                                trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>}
                              />
                            )}
                            {canSend && inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                              <>
                                <DropdownMenuItem onClick={() => void act(sendInvoiceAction(workspaceId, inv.id), router)}><Send className="mr-2 h-4 w-4" />{t("inv.send")}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => void act(markInvoicePaidAction(workspaceId, inv.id, true), router)}><CheckCircle2 className="mr-2 h-4 w-4" />{t("inv.markPaid")}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => void act(cancelInvoiceAction(workspaceId, inv.id), router)} className="text-destructive"><Ban className="mr-2 h-4 w-4" />{t("inv.cancel")}</DropdownMenuItem>
                              </>
                            )}
                            {inv.status === "CANCELLED" && canSend && (
                              <DropdownMenuItem onClick={() => void act(sendInvoiceAction(workspaceId, inv.id), router)}><Send className="mr-2 h-4 w-4" />{t("inv.send")}</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-16 text-center">
          <FileText className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">{t("inv.noInvoices")}</p>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "default" | "good" | "danger" }) {
  const toneCls = tone === "good" ? "text-emerald-600" : tone === "danger" ? "text-red-600" : "";
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${toneCls}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

async function act(promise: Promise<{ ok: boolean; error?: string }>, router: ReturnType<typeof useRouter>) {
  const r = await promise;
  if (r.ok) {
    toast.success("Invoice updated");
    router.refresh();
  } else toast.error(r.error ?? "Something went wrong");
}

function InvoiceDialog({
  workspaceId,
  invoice,
  clients,
  projects,
  onDone,
  trigger,
}: {
  workspaceId: string;
  invoice?: InvRow;
  clients: Option[];
  projects: Option[];
  onDone: () => void;
  trigger: React.ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [clientId, setClientId] = useState<string>(invoice?.clientId ?? "");
  const [projectId, setProjectId] = useState<string>(invoice?.projectId ?? "none");
  const [taxRate, setTaxRate] = useState<string>(String(invoice?.taxRate ?? 0));
  const [discount, setDiscount] = useState<string>(String(invoice?.discount ?? 0));
  const [notes, setNotes] = useState<string>(invoice?.notes ?? "");
  const [issueDate, setIssueDate] = useState<string>(invoice ? invoice.issueDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState<string>(invoice?.dueDate ? invoice.dueDate.slice(0, 10) : "");
  const [items, setItems] = useState<Array<{ description: string; quantity: string; unitPrice: string }>>(
    invoice?.items.length
      ? invoice.items.map((i) => ({ description: i.description, quantity: String(i.quantity), unitPrice: String(i.unitPrice) }))
      : [{ description: "", quantity: "1", unitPrice: "" }]
  );

  const computed = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0);
    const rate = parseFloat(taxRate) || 0;
    const disc = parseFloat(discount) || 0;
    const tax = subtotal * (rate / 100);
    return { subtotal, tax, total: Math.max(0, subtotal - disc + tax) };
  }, [items, taxRate, discount]);

  function setItem(i: number, patch: Partial<{ description: string; quantity: string; unitPrice: string }>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function submit() {
    if (!clientId) {
      toast.error(t("inv.client") + " is required");
      return;
    }
    const validItems = items
      .filter((it) => it.description.trim())
      .map((it) => ({
        description: it.description.trim(),
        quantity: parseFloat(it.quantity) || 0,
        unitPrice: parseFloat(it.unitPrice) || 0,
      }));
    if (!validItems.length) {
      toast.error(t("inv.addItem"));
      return;
    }
    setPending(true);
    try {
      const payload = {
        clientId,
        projectId: projectId === "none" ? null : projectId,
        issueDate: new Date(issueDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        taxRate: parseFloat(taxRate) || 0,
        discount: parseFloat(discount) || 0,
        notes,
        items: validItems,
      };
      const r =
        invoice
          ? await updateInvoiceAction(workspaceId, invoice.id, payload)
          : await createInvoiceAction(workspaceId, payload);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(invoice ? "Invoice updated" : "Invoice created");
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
            <DialogTitle>{invoice ? `Edit ${invoice.number}` : t("inv.newInvoice")}</DialogTitle>
            <DialogDescription>{t("inv.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("inv.client")}</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("inv.project")}</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("inv.none")}</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("inv.issueDate")}</Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("inv.dueDate")}</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("inv.taxRate")}</Label>
                <Input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t("inv.items")}</Label>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_70px_100px_auto] gap-2 items-center">
                    <Input value={item.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder={t("inv.description")} className="h-9" />
                    <Input type="number" value={item.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} placeholder="Qty" className="h-9" />
                    <Input type="number" value={item.unitPrice} onChange={(e) => setItem(i, { unitPrice: e.target.value })} placeholder="Price" className="h-9" />
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} disabled={items.length === 1}>×</Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, { description: "", quantity: "1", unitPrice: "" }])}>
                <Plus className="mr-1 h-3.5 w-3.5" />{t("inv.addItem")}
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t("inv.notes")}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="resize-none" />
            </div>

            <div className="flex flex-col items-end gap-1 rounded-lg bg-muted p-3 text-sm">
              <div className="flex w-56 justify-between text-muted-foreground">
                <span>{t("inv.subtotal")}</span><span>{formatMoney(computed.subtotal, "USD")}</span>
              </div>
              <div className="flex w-56 justify-between text-muted-foreground">
                <span>{t("inv.tax")} ({taxRate || 0}%)</span><span>{formatMoney(computed.tax, "USD")}</span>
              </div>
              <div className="flex w-56 justify-between font-bold">
                <span>{t("inv.total")}</span><span>{formatMoney(computed.total, "USD")}</span>
              </div>
            </div>

            {invoice && parseFloat(discount) > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">{t("inv.discount")}</Label>
                <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("crm.cancel")}</Button>
            <Button onClick={() => void submit()} disabled={pending || !clientId}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {invoice ? "Save changes" : t("inv.newInvoice")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
