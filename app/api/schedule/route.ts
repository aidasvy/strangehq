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

  // Validate all shift userIds belong to this company (include inactive members so
  // resaving a week that has a since-deactivated employee's existing shift doesn't fail)
  if (shifts?.length > 0) {
    const validUserIds = new Set(
      (await db.companyMember.findMany({ where: { companyId }, select: { userId: true } }))
        .map((m) => m.userId)
    );
    const invalid = shifts.find((s: { userId: string }) => !validUserIds.has(s.userId));
    if (invalid) return NextResponse.json({ error: "One or more users do not belong to this company" }, { status: 403 });
  }

  const warnings: string[] = [];

  // Resaving replaces all shift rows (new ids), which would silently cascade-delete
  // any pending swap requests tied to the old shift rows. Reject those explicitly first
  // so the admin sees what happened instead of swaps vanishing with no trace.
  const affectedSwaps = await db.shiftSwapRequest.findMany({
    where: {
      status: { in: ["PENDING_TARGET", "PENDING_ADMIN"] },
      OR: [
        { requesterShift: { scheduleId: schedule.id } },
        { targetShift: { scheduleId: schedule.id } },
      ],
    },
    include: { requester: { select: { name: true } }, targetUser: { select: { name: true } } },
  });
  if (affectedSwaps.length > 0) {
    await db.shiftSwapRequest.updateMany({
      where: { id: { in: affectedSwaps.map((s) => s.id) } },
      data: { status: "REJECTED" },
    });
    for (const s of affectedSwaps) {
      warnings.push(`Cancelled pending swap between ${s.requester.name ?? "employee"} and ${s.targetUser.name ?? "employee"} because the schedule changed`);
    }
  }

  await db.scheduleShift.deleteMany({ where: { scheduleId: schedule.id } });

  if (shifts?.length > 0) {
    const invalidTime = shifts.find((s: { startTime: string; endTime: string }) => s.startTime >= s.endTime);
    if (invalidTime) return NextResponse.json({ error: "Shift end time must be after start time" }, { status: 400 });

    // Check for double-booking: same employee already scheduled at a different location on the same date this week
    const shiftUserIds = [...new Set(shifts.map((s: { userId: string }) => s.userId))] as string[];
    const shiftDates = [...new Set(shifts.map((s: { date: string }) => s.date))].map((d) => new Date(d as string));

    const conflicts = await db.scheduleShift.findMany({
      where: {
        userId: { in: shiftUserIds },
        date: { in: shiftDates },
        schedule: { companyId, weekStart: weekStartDate, locationId: { not: locationId } },
      },
      include: { schedule: { select: { location: { select: { name: true } } } } },
    });

    if (conflicts.length > 0) {
      const members = await db.companyMember.findMany({
        where: { userId: { in: [...new Set(conflicts.map((c) => c.userId))] }, companyId },
        include: { user: { select: { name: true } } },
      });
      const nameMap = new Map(members.map((m) => [m.userId, m.user.name ?? m.userId]));
      const msgs = conflicts.map((c) =>
        `${nameMap.get(c.userId)} already scheduled at ${c.schedule.location.name} on ${c.date.toISOString().slice(0, 10)}`
      );
      return NextResponse.json({ error: `Double-booking detected: ${msgs.slice(0, 2).join("; ")}${msgs.length > 2 ? ` (+${msgs.length - 2} more)` : ""}` }, { status: 400 });
    }

    // Calculate total weekly hours per employee (new shifts + existing shifts at other locations)
    const shiftHours = (startTime: string, endTime: string) => {
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      return (eh * 60 + em - (sh * 60 + sm)) / 60;
    };

    const weeklyHours = new Map<string, number>();
    for (const s of shifts as { userId: string; startTime: string; endTime: string }[]) {
      weeklyHours.set(s.userId, (weeklyHours.get(s.userId) ?? 0) + shiftHours(s.startTime, s.endTime));
    }

    const otherWeekShifts = await db.scheduleShift.findMany({
      where: { userId: { in: shiftUserIds }, schedule: { companyId, weekStart: weekStartDate, locationId: { not: locationId } } },
    });
    for (const s of otherWeekShifts) {
      weeklyHours.set(s.userId, (weeklyHours.get(s.userId) ?? 0) + shiftHours(s.startTime, s.endTime));
    }

    const overLimit = [...weeklyHours.entries()].filter(([, h]) => h > 40);
    if (overLimit.length > 0) {
      const overMembers = await db.companyMember.findMany({
        where: { userId: { in: overLimit.map(([uid]) => uid) }, companyId },
        include: { user: { select: { name: true } } },
      });
      const nameMap2 = new Map(overMembers.map((m) => [m.userId, m.user.name ?? m.userId]));
      for (const [uid, h] of overLimit) {
        warnings.push(`${nameMap2.get(uid)} scheduled for ${h.toFixed(1)}h this week (exceeds 40h limit)`);
      }
    }

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

  return NextResponse.json({ id: schedule.id, status: schedule.status, warnings });
}
