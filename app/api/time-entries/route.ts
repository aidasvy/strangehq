import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId, locationId, clockIn, clockOut, targetUserId } = await req.json();

  const membership = await db.companyMember.findUnique({
    where: { userId_companyId: { userId: session.user.id, companyId } },
  });
  if (!membership) return NextResponse.json({ error: "Not a member of this company" }, { status: 403 });

  const isAdmin = membership.role === "ADMIN";

  // Admin can log entries for other employees; employees can only log for themselves
  const userId = (targetUserId && isAdmin) ? targetUserId : session.user.id;

  const clockInDate = clockIn ? new Date(clockIn) : new Date();
  if (isNaN(clockInDate.getTime())) {
    return NextResponse.json({ error: "Invalid clockIn date" }, { status: 400 });
  }

  // Only block duplicate open entry for self clock-in (not manual/admin entries with a clockOut)
  if (!clockOut && userId === session.user.id) {
    const open = await db.timeEntry.findFirst({
      where: { userId, clockOut: null },
    });
    if (open) return NextResponse.json({ error: "Already clocked in" }, { status: 400 });
  }

  const clockOutDate = clockOut ? new Date(clockOut) : undefined;
  if (clockOutDate && isNaN(clockOutDate.getTime())) {
    return NextResponse.json({ error: "Invalid clockOut date" }, { status: 400 });
  }
  if (clockOutDate && clockOutDate <= clockInDate) {
    return NextResponse.json({ error: "Clock-out must be after clock-in" }, { status: 400 });
  }

  const entry = await db.timeEntry.create({
    data: {
      userId,
      companyId,
      locationId: locationId ?? null,
      clockIn: clockInDate,
      clockOut: clockOutDate ?? null,
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
