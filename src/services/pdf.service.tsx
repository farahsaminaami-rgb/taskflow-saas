import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth-gate";
import type { InvoiceStatus, InvoiceCurrency } from "@prisma/client";

const CURRENCY_SYMBOL: Record<InvoiceCurrency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
  SAR: "﷼",
  EGP: "E£",
  KWD: "KD",
  QAR: "QR",
};

export interface InvoicePdfData {
  invoice: {
    id: string;
    number: string;
    status: InvoiceStatus;
    currency: InvoiceCurrency;
    issueDate: Date;
    dueDate: Date | null;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    discount: number;
    total: number;
    notes: string | null;
    items: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>;
    client: { companyName: string; contactName: string | null; email: string | null; phone: string | null };
    project: { name: string } | null;
    workspace: { name: string; logoUrl: string | null };
  };
}

function money(n: number, currency: InvoiceCurrency): string {
  return `${CURRENCY_SYMBOL[currency]} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: "#0f172a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },
  brand: { fontSize: 20, fontWeight: "bold", color: "#4f46e5" },
  workspaceName: { fontSize: 12, color: "#334155", marginTop: 2 },
  invoiceTitle: { fontSize: 24, fontWeight: "bold", color: "#0f172a", textAlign: "right" },
  invoiceNumber: { fontSize: 11, color: "#64748b", textAlign: "right", marginTop: 2 },
  grid: { flexDirection: "row", marginBottom: 24 },
  col: { flex: 1 },
  label: { fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  value: { fontSize: 11, color: "#0f172a", marginBottom: 2 },
  table: { marginTop: 8 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingVertical: 8 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#cbd5e1", paddingVertical: 6, backgroundColor: "#f8fafc" },
  colDesc: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 2, textAlign: "right" },
  colAmount: { flex: 2, textAlign: "right" },
  th: { fontSize: 9, color: "#64748b", textTransform: "uppercase" },
  totals: { marginTop: 16, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", width: "45%", paddingVertical: 3 },
  totalRowLabel: { flex: 1, color: "#64748b" },
  totalRowValue: { flex: 1, textAlign: "right" },
  grandTotal: { flexDirection: "row", width: "45%", paddingTop: 6, borderTopWidth: 1.5, borderTopColor: "#0f172a" },
  grandTotalLabel: { flex: 1, fontWeight: "bold", fontSize: 13 },
  grandTotalValue: { flex: 1, textAlign: "right", fontWeight: "bold", fontSize: 13, color: "#4f46e5" },
  notes: { marginTop: 20, fontSize: 10, color: "#475569" },
  footer: { position: "absolute", bottom: 32, left: 40, right: 40, fontSize: 9, color: "#94a3b8", borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
});

function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  const { invoice } = data;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>TaskFlow</Text>
            <Text style={styles.workspaceName}>{invoice.workspace.name}</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>Invoice</Text>
            <Text style={styles.invoiceNumber}>{invoice.number}</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.col}>
            <Text style={styles.label}>Billed To</Text>
            <Text style={styles.value}>{invoice.client.companyName}</Text>
            {invoice.client.contactName && <Text style={styles.value}>{invoice.client.contactName}</Text>}
            {invoice.client.email && <Text style={styles.value}>{invoice.client.email}</Text>}
            {invoice.client.phone && <Text style={styles.value}>{invoice.client.phone}</Text>}
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Invoice Date</Text>
            <Text style={styles.value}>{fmtDate(invoice.issueDate)}</Text>
            <Text style={styles.label}>Due Date</Text>
            <Text style={styles.value}>{fmtDate(invoice.dueDate)}</Text>
            {invoice.project && (
              <>
                <Text style={styles.label}>Project</Text>
                <Text style={styles.value}>{invoice.project.name}</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colDesc]}>Description</Text>
          <Text style={[styles.th, styles.colQty]}>Qty</Text>
          <Text style={[styles.th, styles.colPrice]}>Unit Price</Text>
          <Text style={[styles.th, styles.colAmount]}>Amount</Text>
        </View>
        {invoice.items.map((item, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.colDesc}>{item.description}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <Text style={styles.colPrice}>{money(item.unitPrice, invoice.currency)}</Text>
            <Text style={styles.colAmount}>{money(item.amount, invoice.currency)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalRowLabel}>Subtotal</Text>
            <Text style={styles.totalRowValue}>{money(invoice.subtotal, invoice.currency)}</Text>
          </View>
          {invoice.taxRate > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalRowLabel}>Tax ({invoice.taxRate}%)</Text>
              <Text style={styles.totalRowValue}>{money(invoice.taxAmount, invoice.currency)}</Text>
            </View>
          )}
          {invoice.discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalRowLabel}>Discount</Text>
              <Text style={styles.totalRowValue}>-{money(invoice.discount, invoice.currency)}</Text>
            </View>
          )}
          <View style={styles.grandTotal}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{money(invoice.total, invoice.currency)}</Text>
          </View>
        </View>

        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={styles.label}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text>Generated by TaskFlow</Text>
          <Text>{invoice.workspace.name}</Text>
        </View>
      </Page>
    </Document>
  );
}

export class PdfService {
  /** Load the full invoice and render its PDF as a Buffer. */
  async renderInvoice(workspaceId: string, userId: string, invoiceId: string): Promise<Buffer> {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership || membership.status !== "ACTIVE") {
      throw new AuthError("You are not a member of this workspace.", 403);
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, workspaceId },
      include: {
        client: true,
        project: { select: { id: true, name: true } },
        items: true,
        workspace: { select: { id: true, name: true, logoUrl: true } },
      },
    });
    if (!invoice) throw new AuthError("Invoice not found.", 404);

    const data: InvoicePdfData = {
      invoice: {
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        currency: invoice.currency,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        subtotal: invoice.subtotal,
        taxRate: invoice.taxRate,
        taxAmount: invoice.taxAmount,
        discount: invoice.discount,
        total: invoice.total,
        notes: invoice.notes,
        items: invoice.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          amount: i.amount,
        })),
        client: {
          companyName: invoice.client.companyName,
          contactName: invoice.client.contactName,
          email: invoice.client.email,
          phone: invoice.client.phone,
        },
        project: invoice.project ? { name: invoice.project.name } : null,
        workspace: { name: invoice.workspace.name, logoUrl: invoice.workspace.logoUrl },
      },
    };

    return renderToBuffer(<InvoiceDocument data={data} />);
  }
}

export const pdfService = new PdfService();
