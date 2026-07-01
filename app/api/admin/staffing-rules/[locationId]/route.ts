import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ locationId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { locationId } = await params;

  const membership = await db.companyMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const location = await db.location.findUnique({ where: { id: locationId } });
  if (!location || location.companyId !== membership.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rules = await db.staffingRule.findMany({ where: { locationId } });
  return NextResponse.json(rules);
}

export async function PUT(req: Request, { params }: { params: Promise<{ locationId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { locationId } = await params;

  const membership = await db.companyMember.findFirst({ where: { userId: session.user.id } });
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const location = await db.location.findUnique({ where: { id: locationId } });
  if (!location || location.companyId !== membership.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // rules: Array<{ dayOfWeek: number; hour: number; minStaff: number }>
  const { rules } = await req.json();

  if (!Array.isArray(rules)) {
    return NextResponse.json({ error: "rules must be an array" }, { status: 400 });
  }
  const isValid = (r: { dayOfWeek: number; hour: number; minStaff: number }) =>
    Number.isInteger(r.dayOfWeek) && r.dayOfWeek >= 1 && r.dayOfWeek <= 7 &&
    Number.isInteger(r.hour) && r.hour >= 0 && r.hour <= 23 &&
    Number.isInteger(r.minStaff) && r.minStaff >= 0;
  if (!(rules as { dayOfWeek: number; hour: number; minStaff: number }[]).every(isValid)) {
    return NextResponse.json({ error: "Invalid rule: dayOfWeek must be 1-7, hour 0-23, minStaff >= 0" }, { status: 400 });
  }

  await db.staffingRule.deleteMany({ where: { locationId } });

  const toCreate = (rules as { dayOfWeek: number; hour: number; minStaff: number }[]).filter(
    (r) => r.minStaff > 0
  );

  if (toCreate.length > 0) {
    await db.staffingRule.createMany({
      data: toCreate.map((r) => ({ locationId, ...r })),
    });
  }

  return NextResponse.json({ ok: true });
}
