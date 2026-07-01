import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId, startDate, endDate, reason, type } = await req.json();

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Start and end dates are required" }, { status: 400 });
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start > end) {
    return NextResponse.json({ error: "Start date must be before end date" }, { status: 400 });
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (start < today) {
    return NextResponse.json({ error: "Cannot request leave for a date in the past" }, { status: 400 });
  }

  const membership = await db.companyMember.findUnique({
    where: { userId_companyId: { userId: session.user.id, companyId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!membership.employmentStartDate) {
    return NextResponse.json({ error: "Your employment start date has not been set. Contact your admin." }, { status: 403 });
  }

  // Block overlap with any request that isn't already rejected
  const overlapping = await db.holidayRequest.findFirst({
    where: {
      userId: session.user.id,
      companyId,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });
  if (overlapping) {
    return NextResponse.json({ error: "You already have a request covering these dates" }, { status: 409 });
  }

  const request = await db.holidayRequest.create({
    data: {
      userId: session.user.id,
      companyId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason: reason || null,
      type: type === "UNPAID" ? "UNPAID" : "PAID",
    },
  });

  return NextResponse.json(request, { status: 201 });
}
