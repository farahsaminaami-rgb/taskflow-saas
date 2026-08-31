"use client";

import * as React from "react";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { Loader2, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { acceptInvitationAction } from "@/actions/member.actions";
import { Button } from "@/components/ui/button";

export default function InviteAcceptPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md rounded-xl border bg-background p-8 shadow-sm">
        <Suspense
          fallback={
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <InviteBody />
        </Suspense>
      </div>
    </div>
  );
}

function InviteBody() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get("token") ?? "";

  if (status === "loading") {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="font-medium">Invalid invitation link</p>
        <p className="mt-1 text-sm text-muted-foreground">This link is missing an invitation token.</p>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <PartyPopper className="h-6 w-6 text-primary" />
          </div>
        </div>
        <div>
          <p className="font-medium">You&apos;ve been invited to a workspace</p>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to accept the invitation.</p>
        </div>
        <Button
          className="w-full"
          onClick={() => void signIn(undefined, { callbackUrl: `/invite/accept?token=${token}` })}
        >
          Continue
        </Button>
      </div>
    );
  }

  async function accept() {
    setSubmitting(true);
    setError(null);
    try {
      const r = await acceptInvitationAction(token);
      if (!r.ok) {
        setError(r.error);
        toast.error(r.error);
        return;
      }
      toast.success("Welcome aboard!");
      router.push(`/app/workspace/${r.data.workspaceId}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 text-center">
      <div className="flex justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <PartyPopper className="h-6 w-6 text-primary" />
        </div>
      </div>
      <div>
        <p className="font-medium">Join the workspace</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as <span className="font-medium">{session.user.email}</span>
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" onClick={() => void accept()} disabled={submitting}>
        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Accept invitation
      </Button>
      <p className="text-xs text-muted-foreground">
        <Link className="underline underline-offset-4" href="/app">
          Not you? Go to your dashboard
        </Link>
      </p>
    </div>
  );
}