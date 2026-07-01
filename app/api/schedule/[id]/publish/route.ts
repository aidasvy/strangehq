import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendSchedulePublishedEmail, ShiftRow } from "@/lib/email";
import { NextResponse } from "next/server";

const APP_URL = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "https://shiftsync.app";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const schedule = await db.schedule.findUnique({
    where: { id },
    include: {
      location: { select: { name: true } },
      shifts: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { date: "asc" },
      },
    },
  });
  if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await db.companyMember.findUnique({
    where: { userId_companyId: { userId: session.user.id, companyId: schedule.companyId } },
  });
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await db.schedule.update({
    where: { id },
    data: { status: "PUBLISHED" },
  });

  // Send schedule emails — fire and forget (don't block the response)
  if (process.env.RESEND_API_KEY && schedule.shifts.length > 0) {
    const byUser = new Map<string, { name: string; email: string; shifts: ShiftRow[] }>();
    for (const shift of schedule.shifts) {
      if (!byUser.has(shift.userId)) {
        byUser.set(shift.userId, {
          name: shift.user.name ?? "there",
          email: shift.user.email,
          shifts: [],
        });
      }
      byUser.get(shift.userId)!.shifts.push({
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        locationName: schedule.location.name,
      });
    }

    Promise.allSettled(
      Array.from(byUser.values()).map((u) =>
        sendSchedulePublishedEmail({
          to: u.email,
          name: u.name,
          weekStart: schedule.weekStart,
          shifts: u.shifts,
          appUrl: APP_URL,
        })
      )
    ).catch(() => {});
  }

  return NextResponse.json(updated);
}
