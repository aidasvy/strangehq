import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId, locationId, weekStart, shifts } = await req.json();
  if (!locationId) return NextResponse.json({ error: "locationId is required" }, { status: 400 });

  const membership = await db.companyMember.findUnique({
    where: { userId_companyId: { userId: session.user.id, companyId } },
  });
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const location = await db.location.findUnique({ where: { id: locationId } });
  if (!location || location.companyId !== companyId) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  const weekStartDate = new Date(weekStart);

  const schedule = await db.schedule.upsert({
    where: { locationId_weekStart: { locationId, weekStart: weekStartDate } },
    update: {},
    create: { companyId, locationId, weekStart: weekStartDate, status: "DRAFT" },
  });

  // Validate all shift userIds belong to this company
  if (shifts?.length > 0) {
    const validUserIds = new Set(
      (await db.companyMember.findMany({ where: { companyId }, select: { userId: true } }))
        .map((m) => m.userId)
    );
    const invalid = shifts.find((s: { userId: string }) => !validUserIds.has(s.userId));
    if (invalid) return NextResponse.json({ error: "One or more users do not belong to this company" }, { status: 403 });
  }

  await db.scheduleShift.deleteMany({ where: { scheduleId: schedule.id } });

  if (shifts?.length > 0) {
    await db.scheduleShift.createMany({
      data: shifts.map((s: { userId: string; date: string; startTime: string; endTime: string }) => ({
        scheduleId: schedule.id,
        userId: s.userId,
        date: new Date(s.date),
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    });
  }

  return NextResponse.json({ id: schedule.id, status: schedule.status });
}
