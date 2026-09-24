import { ResetPasswordForm } from "@/components/reset-password-form";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-lg px-4 py-8 text-sm text-muted-foreground">Loading…</main>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
