"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The sleek primary submit button shared by the auth forms.
 * Gradient background with a smooth hover lift and an inline loading spinner.
 */
export function SubmitButton({
  loading,
  loadingLabel,
  children,
  className,
}: {
  loading?: boolean;
  loadingLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button
      type="submit"
      disabled={loading}
      className={cn(
        "group relative w-full h-11 overflow-hidden rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 font-semibold text-white shadow-lg shadow-indigo-900/30 transition-all hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-60 disabled:pointer-events-none",
        className
      )}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}
