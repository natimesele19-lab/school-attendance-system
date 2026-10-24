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

  const { data: roleRow, error } = await supabase
    .from("user_roles")
    .select("role, school_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "Unable to verify portal access." }, { status: 500 });
  }
  if (!roleRow || (roleRow.role !== "school_admin" && roleRow.role !== "portal_admin")) {
    return NextResponse.json({ error: "This account is not assigned to an available portal." }, { status: 403 });
  }
  if (roleRow.role === "school_admin" && !roleRow.school_id) {
    return NextResponse.json({ error: "This School Admin account has no school assigned." }, { status: 403 });
  }

  return {
    supabase,
    userId: user.id,
    role: roleRow.role as PortalRole,
    schoolId: roleRow.school_id
  };
}

export function isResponse(value: PortalContext | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
