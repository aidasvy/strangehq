import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { computeLeaveBalance, countWorkingDays } from "@/lib/leave";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status } = await req.json();

  if (!["APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const request = await db.holidayRequest.findUnique({ where: { id } });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await db.companyMember.findUnique({
    where: { userId_companyId: { userId: session.user.id, companyId: request.companyId } },
  });
  if (!membership || (membership.role !== "ADMIN" && membership.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // When approving a paid leave request, verify the employee has enough balance
  if (status === "APPROVED" && request.type === "PAID") {
    const year = request.startDate.getFullYear();

    const [employee, otherRequests] = await Promise.all([
      db.companyMember.findUnique({ where: { userId_companyId: { userId: request.userId, companyId: request.companyId } } }),
      db.holidayRequest.findMany({
        where: { userId: request.userId, companyId: request.companyId, id: { not: id } },
      }),
    ]);

    const annualLeaveDays = employee?.annualLeaveDays ?? 20;
    const employmentStartDate = employee?.employmentStartDate ?? null;
    const approved = otherRequests.filter((r) => r.status === "APPROVED").map((r) => ({ startDate: r.startDate, endDate: r.endDate, type: r.type }));
    const pending = otherRequests.filter((r) => r.status === "PENDING").map((r) => ({ startDate: r.startDate, endDate: r.endDate, type: r.type }));
    const balance = computeLeaveBalance(annualLeaveDays, employmentStartDate, approved, pending, year);
    const requestDays = countWorkingDays(request.startDate, request.endDate);

    if (requestDays > balance.remainingDays) {
      return NextResponse.json(
        { error: `Insufficient leave balance: ${requestDays} days requested, ${balance.remainingDays} remaining` },
        { status: 400 }
      );
    }
  }

  const updated = await db.holidayRequest.update({ where: { id }, data: { status } });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const request = await db.holidayRequest.findUnique({ where: { id } });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the owner can cancel, and only while pending
  if (request.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "Only pending requests can be cancelled" }, { status: 400 });
  }

  await db.holidayRequest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
