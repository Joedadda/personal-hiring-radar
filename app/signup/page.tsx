import { AuthScreen } from "@/components/auth-screen";
import { currentSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SignupPage() {
  const session = await currentSession();
  if (session) redirect("/");
  return <AuthScreen mode="signup" />;
}
