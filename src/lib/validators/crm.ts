import { z } from "zod";
import { ClientStatus, InvoiceStatus, InvoiceCurrency } from "@prisma/client";

const requiredString = (min = 1, max = 160, label = "This field") =>
  z
    .string()
    .trim()
    .min(min, `${label} is required`)
    .max(max, `${label} is too long`);

export const createClientSchema = z.object({
  companyName: requiredString(1, 120, "Company name"),
  contactName: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().max(60).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  status: z.nativeEnum(ClientStatus).default(ClientStatus.LEAD),
  notes: z.string().max(10_000).optional().or(z.literal("")),
});

export const updateClientSchema = createClientSchema.partial();

export const invoiceItemSchema = z.object({
  id: z.string().uuid().optional(),
  description: requiredString(1, 240, "Item description"),
  quantity: z.number().min(0).max(1_000_000).default(1),
  unitPrice: z.number().min(0).max(1_000_000_000).default(0),
});

export const createInvoiceSchema = z.object({
  clientId: z.string().uuid("Invalid client id"),
  projectId: z.string().uuid().nullable().optional(),
  status: z.nativeEnum(InvoiceStatus).default(InvoiceStatus.DRAFT),
  currency: z.nativeEnum(InvoiceCurrency).default(InvoiceCurrency.USD),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().nullable().optional(),
  taxRate: z.number().min(0).max(100).default(0),
  discount: z.number().min(0).max(1_000_000_000).default(0),
  notes: z.string().max(10_000).optional().or(z.literal("")),
  items: z.array(invoiceItemSchema).min(1, "Add at least one line item").max(200),
});

export const updateInvoiceSchema = createInvoiceSchema.partial().extend({
  items: z.array(invoiceItemSchema).min(1, "Add at least one line item").max(200).optional(),
});

export const sendInvoiceSchema = z.object({
  id: z.string().uuid("Invalid invoice id"),
});

export const markInvoicePaidSchema = z.object({
  id: z.string().uuid("Invalid invoice id"),
  paid: z.boolean().default(true),
});

export const cancelInvoiceSchema = z.object({
  id: z.string().uuid("Invalid invoice id"),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
