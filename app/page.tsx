import { RadarApp } from "@/components/radar-app";
import { currentSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Page() {
  const session = await currentSession();
  if (!session) redirect("/login");
  return <RadarApp accountEmail={session.user.email} />;
}
