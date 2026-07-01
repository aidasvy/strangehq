import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId, weekStart, data } = await req.json();

  // Validate data structure before persisting
  if (!Array.isArray(data)) {
    return NextResponse.json({ error: "Invalid availability data" }, { status: 400 });
  }
  for (const slot of data) {
    if (!slot || typeof slot !== "object") {
      return NextResponse.json({ error: "Invalid slot in availability data" }, { status: 400 });
    }
    if (!Number.isInteger(slot.day) || slot.day < 1 || slot.day > 7) {
      return NextResponse.json({ error: "Each slot must have day between 1–7" }, { status: 400 });
    }
    if (typeof slot.startTime !== "string" || !/^\d{2}:\d{2}$/.test(slot.startTime)) {
      return NextResponse.json({ error: "Invalid startTime format (expected HH:MM)" }, { status: 400 });
    }
    if (typeof slot.endTime !== "string" || !/^\d{2}:\d{2}$/.test(slot.endTime)) {
      return NextResponse.json({ error: "Invalid endTime format (expected HH:MM)" }, { status: 400 });
    }
    if (slot.startTime >= slot.endTime) {
      return NextResponse.json({ error: "startTime must be before endTime" }, { status: 400 });
    }
  }

  const membership = await db.companyMember.findUnique({
    where: { userId_companyId: { userId: session.user.id, companyId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const availability = await db.availability.upsert({
    where: {
      userId_companyId_weekStart: {
        userId: session.user.id,
        companyId,
        weekStart: new Date(weekStart),
      },
    },
    update: { data },
    create: {
      userId: session.user.id,
      companyId,
      weekStart: new Date(weekStart),
      data,
    },
  });

  return NextResponse.json(availability);
}
