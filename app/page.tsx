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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) redirect("/login?error=lookup");
  if (!profile || (profile.role !== "school_admin" && profile.role !== "portal_admin")) {
    redirect("/login?error=portal");
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("user_roles")
    .select("school_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (assignmentError) redirect("/login?error=lookup");
  if (!assignment) redirect("/login?error=portal");
  if (profile.role === "school_admin" && !assignment.school_id) redirect("/login?error=assignment");

  if (profile.role === "portal_admin") return <PortalDashboard />;
  return <SchoolDashboard />;
}
