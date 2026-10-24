import { NextResponse } from "next/server";
import { getPortalContext, isResponse } from "@/lib/auth";

export async function POST(request: Request) {
  const context = await getPortalContext();
  if (isResponse(context)) return context;
  if (context.role !== "school_admin" || !context.schoolId) {
    return NextResponse.json({ error: "School Admin access is required." }, { status: 403 });
  }

  let body: { full_name?: string; gender?: string; job_title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const fullName = body.full_name?.trim();
  const jobTitle = body.job_title?.trim();
  if (!fullName || !jobTitle || !["ወ", "ሴ"].includes(body.gender ?? "")) {
    return NextResponse.json({ error: "Name, role, and a valid gender are required." }, { status: 400 });
  }
  if (fullName.length > 120 || jobTitle.length > 120) {
    return NextResponse.json({ error: "Name and role must each be 120 characters or fewer." }, { status: 400 });
  }

  const { data, error } = await context.supabase.from("staff").insert({
    school_id: context.schoolId,
    full_name: fullName,
    gender: body.gender,
    job_title: jobTitle
  }).select("id, full_name, gender, job_title, biometric_template_hash").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ staff: data }, { status: 201 });
}
