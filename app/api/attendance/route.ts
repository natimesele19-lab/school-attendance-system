import { NextResponse } from "next/server";
import { getPortalContext, isResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const statuses = ["Present", "Late", "Absent"] as const;
const weekdays = ["ሰኞ", "ማክሰኞ", "ረቡዕ", "ሐሙስ", "ዓርብ"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  if (!body.staff_id || !uuidPattern.test(body.staff_id) || !body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)
    || !weekdays.includes(body.day_of_week as typeof weekdays[number])
    || !statuses.includes(body.status as typeof statuses[number])) {
    return NextResponse.json({ error: "A valid staff member, Ethiopian date, weekday, and status are required." }, { status: 400 });
  }
  if (body.check_in_time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(body.check_in_time)) {
    return NextResponse.json({ error: "Check-in time must use HH:mm format." }, { status: 400 });
  }

  try {
    const staff = await prisma.staff.findFirst({
      where: { id: body.staff_id, schoolId: context.schoolId },
      select: { id: true }
    });
    if (!staff) return NextResponse.json({ error: "Staff member was not found in this school." }, { status: 404 });

    const checkInTime = body.check_in_time
      ? new Date(`1970-01-01T${body.check_in_time}:00.000Z`)
      : null;
    const data = await prisma.attendanceRecord.upsert({
      where: { staffId_date: { staffId: body.staff_id, date: body.date } },
      create: {
        staffId: body.staff_id,
        date: body.date,
        dayOfWeek: body.day_of_week ?? "",
        checkInTime,
        status: body.status ?? "",
        signatureVerified: body.signature_verified ?? false
      },
      update: {
        dayOfWeek: body.day_of_week ?? "",
        checkInTime,
        status: body.status ?? "",
        signatureVerified: body.signature_verified ?? false
      }
    });
    return NextResponse.json({
      record: {
        id: data.id,
        staff_id: data.staffId,
        date: data.date,
        day_of_week: data.dayOfWeek,
        check_in_time: data.checkInTime?.toISOString().slice(11, 19) ?? null,
        status: data.status,
        signature_verified: data.signatureVerified
      }
    });
  } catch (error) {
    console.error("Unable to save attendance.", error);
    return NextResponse.json({ error: "Unable to save attendance." }, { status: 500 });
  }
}
