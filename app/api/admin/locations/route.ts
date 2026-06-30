import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await db.companyMember.findFirst({ where: { userId: session.user.id } });
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const locations = await db.location.findMany({
    where: { companyId: membership.companyId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(locations);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await db.companyMember.findFirst({ where: { userId: session.user.id } });
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, address } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Location name is required" }, { status: 400 });

  const location = await db.location.create({
    data: {
      companyId: membership.companyId,
      name: name.trim(),
      address: address?.trim() || null,
    },
  });

  return NextResponse.json(location, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await db.companyMember.findFirst({ where: { userId: session.user.id } });
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await req.json();

  const count = await db.location.count({ where: { companyId: membership.companyId } });
  if (count <= 1) {
    return NextResponse.json({ error: "Cannot delete the last location" }, { status: 400 });
  }

  const location = await db.location.findUnique({ where: { id } });
  if (!location || location.companyId !== membership.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.location.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
