import { NextResponse } from "next/server";
import { getPortalContext, isResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  try {
    const schoolId = context.schoolId;
    const [school, staff, records] = await Promise.all([
      prisma.school.findUnique({
        where: { id: schoolId },
        select: { id: true, name: true }
      }),
      prisma.staff.findMany({
        where: { schoolId },
        select: {
          id: true,
          fullName: true,
          gender: true,
          jobTitle: true,
          biometricTemplateHash: true
        },
        orderBy: { fullName: "asc" }
      }),
      prisma.attendanceRecord.findMany({
        where: { staff: { schoolId }, date: { in: requestedDates } },
        select: {
          id: true,
          staffId: true,
          date: true,
          dayOfWeek: true,
          checkInTime: true,
          status: true,
          signatureVerified: true
        }
      })
    ]);
    if (!school) return NextResponse.json({ error: "Assigned school was not found." }, { status: 404 });

    return NextResponse.json({
      school,
      staff: staff.map((person) => ({
        id: person.id,
        full_name: person.fullName,
        gender: person.gender,
        job_title: person.jobTitle,
        biometric_template_hash: person.biometricTemplateHash
      })),
      records: records.map((record) => ({
        id: record.id,
        staff_id: record.staffId,
        date: record.date,
        day_of_week: record.dayOfWeek,
        check_in_time: record.checkInTime?.toISOString().slice(11, 19) ?? null,
        status: record.status,
        signature_verified: record.signatureVerified
      })),
      role: context.role
    });
  } catch (error) {
    console.error("Unable to load school attendance dashboard.", error);
    return NextResponse.json({ error: "Unable to load school attendance dashboard." }, { status: 500 });
  }
}
