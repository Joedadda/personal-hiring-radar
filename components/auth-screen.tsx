"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Mode = "login" | "signup" | "forgot";

function messageOf(error: { message?: string } | null | undefined, fallback: string) {
  return error?.message || fallback;
}

export function AuthScreen({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "forgot") {
        const result = await authClient.requestPasswordReset({
          email: email.trim(),
          redirectTo: "/reset-password",
        });
        if (result.error) {
          setError(messageOf(result.error, "Could not send the reset email."));
          return;
        }
        setNotice("If that address has an account, a reset link is on its way.");
        return;
      }
      if (mode === "signup") {
        const result = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
          callbackURL: "/",
        });
        if (result.error) {
          setError(messageOf(result.error, "Could not create the account."));
          return;
        }
      } else {
        const result = await authClient.signIn.email({
          email: email.trim(),
          password,
          callbackURL: "/",
        });
        if (result.error) {
          setError(messageOf(result.error, "Could not sign in."));
          return;
        }
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/" });
      if (result.error) setError(messageOf(result.error, "Google sign-in is not available."));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Google sign-in is not available.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "signup" ? "Create your desk" : mode === "forgot" ? "Reset your password" : "Sign in";
  const description =
    mode === "signup"
      ? "Each account keeps its own companies, roles, and notes."
      : mode === "forgot"
        ? "We will email a link if this address already has a desk."
        : "Open the desk that belongs to you.";

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
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <form onSubmit={(event) => void onSubmit(event)}>
          <CardContent className="flex flex-col gap-4">
            {mode === "signup" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" autoComplete="name" value={name} required onChange={(event) => setName(event.target.value)} />
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                value={email}
                required
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            {mode === "forgot" ? null : (
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  minLength={8}
                  value={password}
                  required
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            )}
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="text-sm text-muted-foreground" role="status">
                {notice}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-col items-stretch gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? "Working…" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
            </Button>
            {mode === "forgot" ? null : (
              <Button type="button" variant="outline" disabled={busy} onClick={() => void signInWithGoogle()}>
                Continue with Google
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>
      <p className="text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            <Link className="underline underline-offset-4" href="/signup">
              Create an account
            </Link>
            {" · "}
            <Link className="underline underline-offset-4" href="/forgot-password">
              Forgot password
            </Link>
          </>
        ) : (
          <Link className="underline underline-offset-4" href="/login">
            Back to sign in
          </Link>
        )}
      </p>
    </main>
  );
}
