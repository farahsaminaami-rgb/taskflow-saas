"use client";

import { useEffect, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Radix date-picker kept dependency-light: reuses the calendar grid from the
 * same ecosystem (see `calendar.tsx`). Swappable for a real date library.
 */
interface DatePickerProps {
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function DatePicker({ value, onChange, disabled, placeholder = "Add due date", className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [internalDate, setInternalDate] = useState<Date | null>(value ?? null);

  // Keep internal mirror in sync when value arrives async.
  useEffect(() => setInternalDate(value ?? null), [value]);

  const select = (date: Date | null) => {
    setInternalDate(date);
    onChange?.(date);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn("justify-start gap-2 font-normal", !internalDate && "text-muted-foreground", className)}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          {internalDate ? format(internalDate, "MMM d, yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          selectedDays={internalDate ? [internalDate] : []}
          onDayClick={select}
          defaultMonth={internalDate ?? new Date()}
        />
      </PopoverContent>
    </Popover>
  );
}