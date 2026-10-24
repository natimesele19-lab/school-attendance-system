import { NextResponse } from "next/server";
import { getPortalContext, isResponse } from "@/lib/auth";

const statuses = ["Present", "Late", "Absent"] as const;

export async function POST(request: Request) {
  const context = await getPortalContext();
  if (isResponse(context)) return context;
  if (context.role !== "school_admin" || !context.schoolId) {
    return NextResponse.json({ error: "School Admin access is required." }, { status: 403 });
  }

  let body: {
    staff_id?: string;
    date?: string;
    day_of_week?: string;
    check_in_time?: string | null;
    status?: string;
    signature_verified?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.staff_id || !body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)
    || !body.day_of_week || !statuses.includes(body.status as typeof statuses[number])) {
    return NextResponse.json({ error: "A valid staff member, Ethiopian date, weekday, and status are required." }, { status: 400 });
  }
  if (body.check_in_time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(body.check_in_time)) {
    return NextResponse.json({ error: "Check-in time must use HH:mm format." }, { status: 400 });
  }

  const { data: staff, error: staffError } = await context.supabase
    .from("staff")
    .select("id")
    .eq("id", body.staff_id)
    .eq("school_id", context.schoolId)
    .maybeSingle();
  if (staffError) return NextResponse.json({ error: staffError.message }, { status: 500 });
  if (!staff) return NextResponse.json({ error: "Staff member was not found in this school." }, { status: 404 });

  const { data, error } = await context.supabase.from("attendance_records").upsert({
    staff_id: body.staff_id,
    date: body.date,
    day_of_week: body.day_of_week,
    check_in_time: body.check_in_time ?? null,
    status: body.status,
    signature_verified: body.signature_verified ?? false
  }, { onConflict: "staff_id,date" })
    .select("id, staff_id, date, day_of_week, check_in_time, status, signature_verified")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ record: data });
}
