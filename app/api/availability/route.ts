import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId, weekStart, data } = await req.json();

  const membership = await db.companyMember.findUnique({
    where: { userId_companyId: { userId: session.user.id, companyId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const availability = await db.availability.upsert({
    where: {
      userId_companyId_weekStart: {
        userId: session.user.id,
        companyId,
        weekStart: new Date(weekStart),
      },
    },
    update: { data },
    create: {
      userId: session.user.id,
      companyId,
      weekStart: new Date(weekStart),
      data,
    },
  });

  return NextResponse.json(availability);
}
