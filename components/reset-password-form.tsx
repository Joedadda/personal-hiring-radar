"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const invalid = params.get("error") === "INVALID_TOKEN" || !token;
  const [password, setPassword] = useState("");
  const [error, setError] = useState(invalid ? "This reset link is invalid or expired." : "");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    setError("");
    const result = await authClient.resetPassword({ newPassword: password, token });
    setBusy(false);
    if (result.error) {
      setError(result.error.message || "Could not reset the password.");
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-6 px-4 py-8">
      <header>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Personal</p>
        <p className="text-lg font-semibold" translate="no">
          Hiring Radar
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>Use at least 8 characters.</CardDescription>
        </CardHeader>
        <form onSubmit={(event) => void onSubmit(event)}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                required
                disabled={invalid}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={busy || invalid}>
              {busy ? "Saving…" : "Save password"}
            </Button>
          </CardFooter>
        </form>
      </Card>
      <p className="text-sm text-muted-foreground">
        <Link className="underline underline-offset-4" href="/login">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
