import { redirect } from "next/navigation";
import { getPortalContext, isResponse } from "@/lib/auth";
import { SchoolDashboard, PortalDashboard } from "@/components/dashboards";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL
    || !(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
    redirect("/login");
  }
  const context = await getPortalContext();
  if (isResponse(context)) {
    if (context.status === 401) redirect("/login");
    redirect(context.status === 500 ? "/login?error=lookup" : "/login?error=portal");
  }

  if (context.role === "portal_admin") return <PortalDashboard />;
  return <SchoolDashboard />;
}
