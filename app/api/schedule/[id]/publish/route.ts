import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const schedule = await db.schedule.findUnique({ where: { id } });
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

  return NextResponse.json(updated);
}
