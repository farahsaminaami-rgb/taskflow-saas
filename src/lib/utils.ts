import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNowStrict, format, differenceInCalendarDays } from "date-fns";

/** Merge Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Relative "3h ago" formatting with a stable granularity. */
export function timeAgo(date: Date | string): string {
  return formatDistanceToNowStrict(new Date(date), { addSuffix: true });
}

/** Absolute datetime in a compact, locale-aware shape. */
export function formatDate(date: Date | string, pattern = "MMM d, yyyy"): string {
  return format(new Date(date), pattern);
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy · h:mm a");
}

/** Human-readable "1h 24m" from minutes. */
export function formatDuration(totalMinutes: number): string {
  const rounded = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const MONEY_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
  SAR: "﷼",
  EGP: "E£",
  KWD: "KD",
  QAR: "QR",
};

/** Compact currency formatting with a symbol, e.g. "$1,250.00". */
export function formatMoney(amount: number, currency = "USD"): string {
  const symbol = MONEY_SYMBOL[currency] ?? `${currency} `;
  const value = amount.toLocaleString("en-US", { minimumFractionDigits: Math.abs(amount % 1) > 0.004 ? 2 : 0, maximumFractionDigits: 2 });
  return `${symbol}${value}`;
}

/** Returns the integer number of calendar days between now and a due date. */
export function daysUntil(date: Date | string): number {
  return differenceInCalendarDays(new Date(date), new Date());
}

/** Is a due date overdue relative to today? */
export function isOverdue(dueAt: Date | string, completedAt?: Date | string | null): boolean {
  if (completedAt) return false;
  return daysUntil(dueAt) < 0;
}

/** Short unique id for optimistic client-side entities (keys, temp ids). */
export function uid(prefix = ""): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36).slice(-4);
  return `${prefix}${time}${rand}`;
}

/** Initials for an avatar, e.g. "Ada Lovelace" -> "AL". */
export function initials(name?: string | null, fallback = "?"): string {
  if (!name) return fallback;
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function truncate(value: string, max = 160): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export { cn as default };