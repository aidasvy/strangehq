import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: locationId } = await params;

  const location = await db.location.findUnique({ where: { id: locationId } });
  if (!location) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await db.companyMember.findUnique({
    where: { userId_companyId: { userId: session.user.id, companyId: location.companyId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const hours = await db.locationHours.findMany({
    where: { locationId },
    orderBy: { dayOfWeek: "asc" },
  });

  return NextResponse.json(hours);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: locationId } = await params;

  const location = await db.location.findUnique({ where: { id: locationId } });
  if (!location) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await db.companyMember.findUnique({
    where: { userId_companyId: { userId: session.user.id, companyId: location.companyId } },
  });
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { hours } = await req.json() as {
    hours: { dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }[];
  };

  if (!Array.isArray(hours)) {
    return NextResponse.json({ error: "hours must be an array" }, { status: 400 });
  }
  const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const isValid = (h: { dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }) =>
    Number.isInteger(h.dayOfWeek) && h.dayOfWeek >= 1 && h.dayOfWeek <= 7 &&
    typeof h.isOpen === "boolean" &&
    TIME_RE.test(h.openTime) && TIME_RE.test(h.closeTime) &&
    (!h.isOpen || h.openTime < h.closeTime);
  if (!hours.every(isValid)) {
    return NextResponse.json(
      { error: "Invalid hours: dayOfWeek must be 1-7, times must be HH:MM, and openTime must be before closeTime when open" },
      { status: 400 }
    );
  }

  // Upsert each day
  await Promise.all(
    hours.map((h) =>
      db.locationHours.upsert({
        where: { locationId_dayOfWeek: { locationId, dayOfWeek: h.dayOfWeek } },
        create: { locationId, dayOfWeek: h.dayOfWeek, isOpen: h.isOpen, openTime: h.openTime, closeTime: h.closeTime },
        update: { isOpen: h.isOpen, openTime: h.openTime, closeTime: h.closeTime },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
