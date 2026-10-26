import { NextResponse } from "next/server";
import type { PortalRole as PrismaPortalRole } from "@prisma/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export type PortalRole = PrismaPortalRole;
export type PortalContext = {
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

  let assignment;
  try {
    assignment = await prisma.userRole.findUnique({
      where: { userId: user.id },
      select: { role: true, schoolId: true }
    });
  } catch (error) {
    console.error("Unable to verify portal access.", error);
    return NextResponse.json({ error: "Unable to verify portal access." }, { status: 500 });
  }
  if (!assignment) {
    return NextResponse.json({ error: "This account is not assigned to an available portal." }, { status: 403 });
  }

  if (assignment.role === "school_admin" && !assignment.schoolId) {
    return NextResponse.json({ error: "This School Admin account has no school assigned." }, { status: 403 });
  }

  return {
    userId: user.id,
    role: assignment.role,
    schoolId: assignment.schoolId
  };
}

export function isResponse(value: PortalContext | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
