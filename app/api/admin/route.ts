import { NextResponse } from "next/server";
import { getPortalContext, isResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getPortalContext();
  if (isResponse(context)) return context;
  if (context.role !== "portal_admin") {
    return NextResponse.json({ error: "Portal Admin access is required." }, { status: 403 });
  }

  const [schoolsResult, staffResult, devicesResult, logsResult, statusResult] = await Promise.all([
    context.supabase.from("schools").select("id, name, created_at").order("name"),
    context.supabase.from("staff").select("id", { count: "exact", head: true }),
    context.supabase.from("biometric_devices").select("id, school_id, device_name, status, last_seen_at, schools(name)").order("device_name"),
    context.supabase.from("scanner_health_logs").select("id, device_id, level, message, created_at").order("created_at", { ascending: false }).limit(12),
    context.supabase.from("system_status").select("component, status, details, updated_at").order("component")
  ]);
  for (const result of [schoolsResult, staffResult, devicesResult, logsResult, statusResult]) {
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({
    schools: schoolsResult.data ?? [],
    staffCount: staffResult.count ?? 0,
    devices: devicesResult.data ?? [],
    logs: logsResult.data ?? [],
    systemStatus: statusResult.data ?? []
  });
}
