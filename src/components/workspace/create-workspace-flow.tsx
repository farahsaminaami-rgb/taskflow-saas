"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Building2 } from "lucide-react";
import { createWorkspaceAction } from "@/actions/workspace.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/client-provider";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function CreateWorkspaceFlow() {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await createWorkspaceAction({ name, slug });
      if (result.ok) {
        toast.success(t("workspace.createdToast"));
        router.push(`/app/workspace/${result.data.slug}`);
        router.refresh();
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Building2 className="h-5 w-5 text-primary" />
          {t("workspace.createTitle")}
        </CardTitle>
        <CardDescription>
          {t("workspace.createDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">{t("workspace.name")}</Label>
            <Input
              id="ws-name"
              value={name}
              placeholder={t("workspace.namePlaceholder")}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug || slug === slugify(name)) setSlug(slugify(e.target.value));
              }}
              required
              maxLength={80}
              autoFocus
            />
            {fieldErrors.name?.map((m) => (
              <p key={m} className="text-sm text-destructive">
                {m}
              </p>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-slug">{t("workspace.url")}</Label>
            <div className="flex items-center gap-2 rounded-md border border-input bg-muted/30 px-3">
              <span className="text-sm text-muted-foreground">taskflow.app/</span>
              <Input
                id="ws-slug"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                required
                maxLength={32}
              />
            </div>
            {fieldErrors.slug?.map((m) => (
              <p key={m} className="text-sm text-destructive">
                {m}
              </p>
            ))}
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending && <Loader2 className="animate-spin" />}
            {t("workspace.createTitle")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}