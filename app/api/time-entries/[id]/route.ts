import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const entry = await db.timeEntry.findUnique({ where: { id } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await db.companyMember.findUnique({
    where: { userId_companyId: { userId: session.user.id, companyId: entry.companyId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const isAdmin = membership.role === "ADMIN";
  const isOwner = entry.userId === session.user.id;

  const updates: Record<string, unknown> = {};

  // Notes: owner can always update
  if ("notes" in body && (isOwner || isAdmin)) updates.notes = body.notes;

  // Clock-out: owner can clock out their open entry, admin can set any
  if ("clockOut" in body) {
    if (isOwner && !entry.clockOut) {
      updates.clockOut = body.clockOut ? new Date(body.clockOut) : new Date();
    } else if (isAdmin) {
      updates.clockOut = body.clockOut ? new Date(body.clockOut) : null;
    }
  } else if (isOwner && !entry.clockOut && !("status" in body) && !("clockIn" in body)) {
    // Legacy: PATCH with no specific field = clock out
    updates.clockOut = new Date();
  }

  // Clock-in adjustment: owner can correct pending/rejected entry, admin can correct any
  if ("clockIn" in body) {
    const newClockIn = new Date(body.clockIn);
    if (isNaN(newClockIn.getTime())) {
      return NextResponse.json({ error: "Invalid clockIn date" }, { status: 400 });
    }
    if (isOwner && (entry.status === "PENDING" || entry.status === "REJECTED")) {
      updates.clockIn = newClockIn;
      if (entry.status === "REJECTED") updates.status = "PENDING"; // resubmit
    } else if (isAdmin) {
      updates.clockIn = newClockIn;
    }
  }

  // Clock-out correction on rejected: owner can also fix clockOut to resubmit
  if ("clockOut" in body && isOwner && entry.status === "REJECTED" && !("status" in updates)) {
    const newClockOut = body.clockOut ? new Date(body.clockOut) : null;
    if (newClockOut && isNaN(newClockOut.getTime())) {
      return NextResponse.json({ error: "Invalid clockOut date" }, { status: 400 });
    }
    updates.clockOut = newClockOut;
    updates.status = "PENDING"; // resubmit
  }

  // Status: admin only
  if ("status" in body && isAdmin) {
    if (!["APPROVED", "REJECTED"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Validate final clockIn < clockOut after applying updates
  const finalClockIn = (updates.clockIn as Date | undefined) ?? entry.clockIn;
  const finalClockOut = (updates.clockOut as Date | null | undefined) ?? entry.clockOut;
  if (finalClockOut && finalClockOut <= finalClockIn) {
    return NextResponse.json({ error: "Clock-out must be after clock-in" }, { status: 400 });
  }

  const updated = await db.timeEntry.update({ where: { id }, data: updates });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const entry = await db.timeEntry.findUnique({ where: { id } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await db.companyMember.findUnique({
    where: { userId_companyId: { userId: session.user.id, companyId: entry.companyId } },
  });
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.timeEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
