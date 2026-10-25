import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PortalRole = "school_admin" | "portal_admin";
export type PortalContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  role: PortalRole;
  schoolId: string | null;
};

export async function getPortalContext(): Promise<PortalContext | NextResponse> {
  const supabase = createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json({ error: "Unable to verify portal access." }, { status: 500 });
  }
  if (!profile || (profile.role !== "school_admin" && profile.role !== "portal_admin")) {
    return NextResponse.json({ error: "This account is not assigned to an available portal." }, { status: 403 });
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("user_roles")
    .select("school_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (assignmentError) {
    return NextResponse.json({ error: "Unable to verify portal access." }, { status: 500 });
  }
  if (!assignment) {
    return NextResponse.json({ error: "This account is not assigned to an available portal." }, { status: 403 });
  }
  if (profile.role === "school_admin" && !assignment.school_id) {
    return NextResponse.json({ error: "This School Admin account has no school assigned." }, { status: 403 });
  }

  return {
    supabase,
    userId: user.id,
    role: profile.role,
    schoolId: assignment.school_id
  };
}

export function isResponse(value: PortalContext | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
