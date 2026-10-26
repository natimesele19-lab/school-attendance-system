import { NextResponse } from "next/server";
import { getPortalContext, isResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const gender = body.gender;
  const jobTitle = body.job_title?.trim();
  if (!fullName || !jobTitle || !["ወ", "ሴ"].includes(gender ?? "")) {
    return NextResponse.json({ error: "Name, role, and a valid gender are required." }, { status: 400 });
  }
  if (fullName.length > 120 || jobTitle.length > 120) {
    return NextResponse.json({ error: "Name and role must each be 120 characters or fewer." }, { status: 400 });
  }

  try {
    const data = await prisma.staff.create({
      data: {
        schoolId: context.schoolId,
        fullName,
        gender: gender ?? "",
        jobTitle
      },
      select: {
        id: true,
        fullName: true,
        gender: true,
        jobTitle: true,
        biometricTemplateHash: true
      }
    });
    return NextResponse.json({
      staff: {
        id: data.id,
        full_name: data.fullName,
        gender: data.gender,
        job_title: data.jobTitle,
        biometric_template_hash: data.biometricTemplateHash
      }
    }, { status: 201 });
  } catch (error) {
    console.error("Unable to register staff.", error);
    return NextResponse.json({ error: "Unable to register staff." }, { status: 500 });
  }
}
