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
  let userId = session.user.id;
  if (targetUserId && isAdmin) {
    const targetMember = await db.companyMember.findUnique({
      where: { userId_companyId: { userId: targetUserId, companyId } },
    });
    if (!targetMember) return NextResponse.json({ error: "User not found in this company" }, { status: 404 });
    userId = targetUserId;
  }

  const clockInDate = clockIn ? new Date(clockIn) : new Date();
  if (isNaN(clockInDate.getTime())) {
    return NextResponse.json({ error: "Invalid clockIn date" }, { status: 400 });
  }

  const clockOutDate = clockOut ? new Date(clockOut) : undefined;
  if (clockOutDate && isNaN(clockOutDate.getTime())) {
    return NextResponse.json({ error: "Invalid clockOut date" }, { status: 400 });
  }
  if (clockOutDate && clockOutDate <= clockInDate) {
    return NextResponse.json({ error: "Clock-out must be after clock-in" }, { status: 400 });
  }

  // Verify locationId belongs to this company
  if (locationId) {
    const loc = await db.location.findUnique({ where: { id: locationId } });
    if (!loc || loc.companyId !== companyId) {
      return NextResponse.json({ error: "Invalid location" }, { status: 400 });
    }
  }

  let entry;
  if (!clockOut) {
    // Atomic check-and-create to prevent duplicate open entries from race conditions
    try {
      entry = await db.$transaction(async (tx) => {
        const open = await tx.timeEntry.findFirst({ where: { userId, clockOut: null } });
        if (open) throw new Error("ALREADY_CLOCKED_IN");
        return tx.timeEntry.create({
          data: { userId, companyId, locationId: locationId ?? null, clockIn: clockInDate, clockOut: null },
        });
      }, { isolationLevel: "Serializable" });
    } catch (err) {
      if (err instanceof Error && err.message === "ALREADY_CLOCKED_IN") {
        return NextResponse.json({ error: "Already clocked in" }, { status: 400 });
      }
      throw err;
    }
  } else {
    entry = await db.timeEntry.create({
      data: { userId, companyId, locationId: locationId ?? null, clockIn: clockInDate, clockOut: clockOutDate ?? null },
    });
  }

  return NextResponse.json(entry, { status: 201 });
}
