import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const failedAttempts = new Map<string, { count: number; resetAt: number }>();

function getRateLimitKey(req: Request, userId: string): string {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  return `${userId}:${ip}`;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const attempt = failedAttempts.get(key);

  if (!attempt || now > attempt.resetAt) {
    failedAttempts.set(key, { count: 0, resetAt: now + 15 * 60 * 1000 });
    return true;
  }

  return attempt.count < 5;
}

function recordFailedAttempt(key: string): void {
  const attempt = failedAttempts.get(key);
  if (attempt) {
    attempt.count++;
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimitKey = getRateLimitKey(req, session.user.id);
  if (!checkRateLimit(rateLimitKey)) {
    return NextResponse.json(
      { error: "Too many failed attempts. Please try again in 15 minutes." },
      { status: 429 }
    );
  }

  const { code } = await req.json();
  if (!code?.trim()) return NextResponse.json({ error: "Invite code is required" }, { status: 400 });

  const existing = await db.companyMember.findFirst({ where: { userId: session.user.id, isActive: true } });
  if (existing) return NextResponse.json({ error: "You already belong to a company" }, { status: 400 });

  const invite = await db.inviteCode.findUnique({ where: { code: code.trim().toUpperCase() } });

  if (!invite) {
    recordFailedAttempt(rateLimitKey);
    return NextResponse.json({ error: "Invalid invite code" }, { status: 400 });
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    recordFailedAttempt(rateLimitKey);
    return NextResponse.json({ error: "This invite code has expired" }, { status: 400 });
  }
  if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) {
    recordFailedAttempt(rateLimitKey);
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
