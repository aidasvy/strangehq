import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids, status } = await req.json();

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }
  if (!["APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership || (membership.role !== "ADMIN" && membership.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await db.timeEntry.updateMany({
    where: {
      id: { in: ids },
      companyId: membership.companyId,
      clockOut: { not: null },
      status: "PENDING",
    },
    data: { status },
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
