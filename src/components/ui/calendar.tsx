"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export interface CalendarProps {
  selectedDays?: Date[];
  onDayClick?: (date: Date) => void;
  defaultMonth?: Date;
  disabledDays?: (date: Date) => boolean;
  className?: string;
}

/** Minimal dependency calendar grid — dates selected via `selectedDays`. */
export function Calendar({
  selectedDays = [],
  onDayClick,
  defaultMonth,
  disabledDays,
  className,
}: CalendarProps) {
  const [month, setMonth] = React.useState<Date>(defaultMonth ?? new Date());
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end });

  const isSelected = (day: Date) => selectedDays.some((d) => isSameDay(d, day));

  return (
    <div className={cn("w-fit p-3", className)}>
      <div className="mb-3 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="iconSm"
          onClick={() => setMonth((m) => subMonths(m, 1))}
          aria-label="Previous month"
        >
          <ChevronLeft />
        </Button>
        <div className="text-sm font-medium">{format(month, "MMMM yyyy")}</div>
        <Button
          type="button"
          variant="ghost"
          size="iconSm"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          aria-label="Next month"
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-xs font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const selected = isSelected(day);
          const outside = !isSameMonth(day, month);
          const disabled = disabledDays?.(day) ?? false;
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onDayClick?.(day)}
              disabled={disabled || outside}
              className={cn(
                "h-8 w-8 rounded-md text-sm tabular-nums transition-colors",
                outside && "text-muted-foreground/40",
                isToday(day) && !selected && "border border-primary/50",
                selected && "bg-primary text-primary-foreground shadow",
                !selected && !outside && "hover:bg-accent",
                disabled && "cursor-not-allowed opacity-30"
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}