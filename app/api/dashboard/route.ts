import { NextResponse } from "next/server";
import { getPortalContext, isResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await getPortalContext();
  if (isResponse(context)) return context;
  if (context.role !== "school_admin" || !context.schoolId) {
    return NextResponse.json({ error: "School Admin access is required." }, { status: 403 });
  }
  const requestedDates = new URL(request.url).searchParams.get("dates")?.split(",") ?? [];
  if (requestedDates.length !== 5 || requestedDates.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    return NextResponse.json({ error: "Request exactly five valid Ethiopian calendar dates." }, { status: 400 });
  }

  const { data: school, error: schoolError } = await context.supabase
    .from("schools")
    .select("id, name")
    .eq("id", context.schoolId)
    .single();
  if (schoolError) return NextResponse.json({ error: schoolError.message }, { status: 500 });

  const { data: staff, error: staffError } = await context.supabase
    .from("staff")
    .select("id, full_name, gender, job_title, biometric_template_hash")
    .eq("school_id", context.schoolId)
    .order("full_name");
  if (staffError) return NextResponse.json({ error: staffError.message }, { status: 500 });

  let records: Record<string, unknown>[] = [];
  if (staff?.length) {
    const { data, error: attendanceError } = await context.supabase
      .from("attendance_records")
      .select("id, staff_id, date, day_of_week, check_in_time, status, signature_verified")
      .in("staff_id", staff.map((person) => person.id))
      .in("date", requestedDates);
    if (attendanceError) return NextResponse.json({ error: attendanceError.message }, { status: 500 });
    records = data ?? [];
  }

  return NextResponse.json({ school, staff: staff ?? [], records, role: context.role });
}
