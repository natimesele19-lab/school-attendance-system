import { NextResponse } from "next/server";
import { getPortalContext, isResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getPortalContext();
  if (isResponse(context)) return context;
  if (context.role !== "portal_admin") {
    return NextResponse.json({ error: "Portal Admin access is required." }, { status: 403 });
  }

  try {
    const [schools, staffCount, devices, logs, systemStatus] = await Promise.all([
      prisma.school.findMany({
        select: { id: true, name: true, createdAt: true },
        orderBy: { name: "asc" }
      }),
      prisma.staff.count(),
      prisma.biometricDevice.findMany({
        select: {
          id: true,
          schoolId: true,
          deviceName: true,
          status: true,
          lastSeenAt: true,
          school: { select: { name: true } }
        },
        orderBy: { deviceName: "asc" }
      }),
      prisma.scannerHealthLog.findMany({
        select: { id: true, deviceId: true, level: true, message: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 12
      }),
      prisma.systemStatus.findMany({
        select: { component: true, status: true, details: true, updatedAt: true },
        orderBy: { component: "asc" }
      })
    ]);
    return NextResponse.json({
      schools: schools.map((school) => ({
        id: school.id,
        name: school.name,
        created_at: school.createdAt
      })),
      staffCount,
      devices: devices.map((device) => ({
        id: device.id,
        school_id: device.schoolId,
        device_name: device.deviceName,
        status: device.status,
        last_seen_at: device.lastSeenAt,
        schools: device.school
      })),
      logs: logs.map((log) => ({
        id: log.id,
        device_id: log.deviceId,
        level: log.level,
        message: log.message,
        created_at: log.createdAt
      })),
      systemStatus: systemStatus.map((item) => ({
        component: item.component,
        status: item.status,
        details: item.details,
        updated_at: item.updatedAt
      }))
    });
  } catch (error) {
    console.error("Unable to load portal administration dashboard.", error);
    return NextResponse.json({ error: "Unable to load portal administration dashboard." }, { status: 500 });
  }
}
