import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SchoolDashboard, PortalDashboard } from "@/components/dashboards";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect("/login");
  }
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: role } = await supabase
    .from("user_roles")
    .select("role, school_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!role || !["school_admin", "portal_admin"].includes(role.role)) redirect("/login?error=portal");
  if (role.role === "school_admin" && !role.school_id) redirect("/login?error=assignment");

  if (role.role === "portal_admin") return <PortalDashboard />;
  return <SchoolDashboard />;
}
