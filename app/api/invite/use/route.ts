import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json();
  if (!code?.trim()) return NextResponse.json({ error: "Invite code is required" }, { status: 400 });

  const existing = await db.companyMember.findFirst({ where: { userId: session.user.id } });
  if (existing) return NextResponse.json({ error: "You already belong to a company" }, { status: 400 });

  const invite = await db.inviteCode.findUnique({ where: { code: code.trim().toUpperCase() } });

  if (!invite) return NextResponse.json({ error: "Invalid invite code" }, { status: 400 });
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invite code has expired" }, { status: 400 });
  }
  if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) {
    return NextResponse.json({ error: "This invite code has reached its limit" }, { status: 400 });
  }

  try {
    await db.$transaction(async (tx) => {
      // Atomically increment usedCount only if still under the limit — prevents race conditions
      const updated = await tx.inviteCode.updateMany({
        where: {
          id: invite.id,
          ...(invite.maxUses !== null ? { usedCount: { lt: invite.maxUses } } : {}),
        },
        data: { usedCount: { increment: 1 } },
      });
      if (updated.count === 0) throw new Error("LIMIT_REACHED");

      await tx.companyMember.create({
        data: { userId: session.user.id, companyId: invite.companyId, role: invite.role },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "LIMIT_REACHED") {
      return NextResponse.json({ error: "This invite code has reached its limit" }, { status: 400 });
    }
    throw err;
  }

  return NextResponse.json({ success: true });
}
