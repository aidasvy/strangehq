import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendSwapRequestedEmail, ShiftRow } from "@/lib/email";
import { NextResponse } from "next/server";

const APP_URL = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "https://shiftsync.app";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requesterShiftId, targetShiftId } = await req.json();
  if (!requesterShiftId || !targetShiftId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const [requesterShift, targetShift] = await Promise.all([
    db.scheduleShift.findUnique({
      where: { id: requesterShiftId },
      include: { schedule: { select: { companyId: true, locationId: true, location: { select: { name: true } } } }, user: { select: { id: true, name: true, email: true } } },
    }),
    db.scheduleShift.findUnique({
      where: { id: targetShiftId },
      include: { schedule: { select: { companyId: true, location: { select: { name: true } } } }, user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  if (!requesterShift || !targetShift) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  // Requester must own their shift
  if (requesterShift.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const companyId = requesterShift.schedule.companyId;

  // Both shifts must be in the same company
  if (targetShift.schedule.companyId !== companyId) {
    return NextResponse.json({ error: "Shifts from different companies" }, { status: 400 });
  }

  // Can't swap with yourself
  if (targetShift.userId === session.user.id) {
    return NextResponse.json({ error: "Cannot swap with yourself" }, { status: 400 });
  }

  // No duplicate pending request for same pair
  const existing = await db.shiftSwapRequest.findFirst({
    where: {
      requesterShiftId,
      targetShiftId,
      status: { in: ["PENDING_TARGET", "PENDING_ADMIN"] },
    },
  });
  if (existing) {
    return NextResponse.json({ error: "Swap request already pending" }, { status: 409 });
  }

  const swap = await db.shiftSwapRequest.create({
    data: {
      companyId,
      requesterId: session.user.id,
      requesterShiftId,
      targetUserId: targetShift.userId,
      targetShiftId,
    },
  });

  // Email the target
  if (process.env.RESEND_API_KEY) {
    const toShiftRow = (s: typeof requesterShift, loc: string): ShiftRow => ({
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      locationName: loc,
    });

    sendSwapRequestedEmail({
      to: targetShift.user.email,
      targetName: targetShift.user.name ?? "there",
      requesterName: requesterShift.user.name ?? "A colleague",
      requesterShift: toShiftRow(requesterShift, requesterShift.schedule.location.name),
      targetShift: toShiftRow(targetShift as typeof requesterShift, targetShift.schedule.location.name),
      swapId: swap.id,
      appUrl: APP_URL,
    }).catch(() => {});
  }

  return NextResponse.json(swap, { status: 201 });
}
