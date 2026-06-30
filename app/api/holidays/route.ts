import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId, startDate, endDate, reason } = await req.json();

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Start and end dates are required" }, { status: 400 });
  }
  if (new Date(startDate) > new Date(endDate)) {
    return NextResponse.json({ error: "Start date must be before end date" }, { status: 400 });
  }

  const membership = await db.companyMember.findUnique({
    where: { userId_companyId: { userId: session.user.id, companyId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const request = await db.holidayRequest.create({
    data: {
      userId: session.user.id,
      companyId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason: reason || null,
    },
  });

  return NextResponse.json(request, { status: 201 });
}
