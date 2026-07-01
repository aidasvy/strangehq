import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

function generateCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId, role } = await req.json();

  const membership = await db.companyMember.findUnique({
    where: { userId_companyId: { userId: session.user.id, companyId } },
  });
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let code: string;
  let attempts = 0;
  do {
    code = generateCode();
    attempts++;
    if (attempts > 10) {
      return NextResponse.json({ error: "Failed to generate unique invite code, please try again" }, { status: 500 });
    }
  } while (await db.inviteCode.findUnique({ where: { code } }));

  const invite = await db.inviteCode.create({
    data: { companyId, code, role: role ?? "EMPLOYEE" },
  });

  return NextResponse.json({
    id: invite.id,
    code: invite.code,
    role: invite.role,
    usedCount: invite.usedCount,
    maxUses: invite.maxUses,
    expiresAt: invite.expiresAt?.toISOString() ?? null,
    createdAt: invite.createdAt.toISOString(),
  }, { status: 201 });
}
