import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  sendSwapPendingAdminEmail,
  sendSwapOutcomeEmail,
  ShiftRow,
} from "@/lib/email";
import { NextResponse } from "next/server";

const APP_URL = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "https://shiftsync.app";

function toShiftRow(shift: { date: Date; startTime: string; endTime: string }, locationName: string): ShiftRow {
  return { date: shift.date, startTime: shift.startTime, endTime: shift.endTime, locationName };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action } = await req.json(); // "accept" | "reject" | "approve" | "deny"

  const swap = await db.shiftSwapRequest.findUnique({
    where: { id },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      targetUser: { select: { id: true, name: true, email: true } },
      requesterShift: { include: { schedule: { select: { location: { select: { name: true } } } } } },
      targetShift: { include: { schedule: { select: { location: { select: { name: true } } } } } },
    },
  });

  if (!swap) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await db.companyMember.findUnique({
    where: { userId_companyId: { userId: session.user.id, companyId: swap.companyId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const isTarget = session.user.id === swap.targetUserId;
  const isAdmin = membership.role === "ADMIN" || membership.role === "MANAGER";

  const reqShiftRow = toShiftRow(swap.requesterShift, swap.requesterShift.schedule.location.name);
  const tgtShiftRow = toShiftRow(swap.targetShift, swap.targetShift.schedule.location.name);

  // ── Target responds ──────────────────────────────────────────────────────────
  if (action === "accept" || action === "reject") {
    if (!isTarget) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (swap.status !== "PENDING_TARGET") {
      return NextResponse.json({ error: "Swap is not awaiting your response" }, { status: 409 });
    }

    if (action === "reject") {
      await db.shiftSwapRequest.update({ where: { id }, data: { status: "REJECTED" } });

      if (process.env.RESEND_API_KEY) {
        sendSwapOutcomeEmail({
          to: swap.requester.email,
          name: swap.requester.name ?? "there",
          approved: false,
          requesterShift: reqShiftRow,
          targetShift: tgtShiftRow,
          isRequester: true,
          appUrl: APP_URL,
        }).catch(() => {});
      }

      return NextResponse.json({ status: "REJECTED" });
    }

    // Accepted → move to PENDING_ADMIN, email admins
    await db.shiftSwapRequest.update({ where: { id }, data: { status: "PENDING_ADMIN" } });

    if (process.env.RESEND_API_KEY) {
      const admins = await db.companyMember.findMany({
        where: { companyId: swap.companyId, role: { in: ["ADMIN", "MANAGER"] }, isActive: true },
        include: { user: { select: { name: true, email: true } } },
      });

      Promise.allSettled(
        admins.map((a) =>
          sendSwapPendingAdminEmail({
            to: a.user.email,
            adminName: a.user.name ?? "there",
            requesterName: swap.requester.name ?? "Employee",
            targetName: swap.targetUser.name ?? "Employee",
            requesterShift: reqShiftRow,
            targetShift: tgtShiftRow,
            appUrl: APP_URL,
          })
        )
      ).catch(() => {});
    }

    return NextResponse.json({ status: "PENDING_ADMIN" });
  }

  // ── Admin approves / denies ──────────────────────────────────────────────────
  if (action === "approve" || action === "deny") {
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (swap.status !== "PENDING_ADMIN") {
      return NextResponse.json({ error: "Swap is not awaiting admin approval" }, { status: 409 });
    }

    if (action === "deny") {
      await db.shiftSwapRequest.update({ where: { id }, data: { status: "REJECTED" } });
    } else {
      // Swap the userId on both shifts, then mark approved
      await db.$transaction([
        db.scheduleShift.update({
          where: { id: swap.requesterShiftId },
          data: { userId: swap.targetUserId },
        }),
        db.scheduleShift.update({
          where: { id: swap.targetShiftId },
          data: { userId: swap.requesterId },
        }),
        db.shiftSwapRequest.update({ where: { id }, data: { status: "APPROVED" } }),
      ]);
    }

    if (process.env.RESEND_API_KEY) {
      const approved = action === "approve";
      Promise.allSettled([
        sendSwapOutcomeEmail({
          to: swap.requester.email,
          name: swap.requester.name ?? "there",
          approved,
          requesterShift: reqShiftRow,
          targetShift: tgtShiftRow,
          isRequester: true,
          appUrl: APP_URL,
        }),
        sendSwapOutcomeEmail({
          to: swap.targetUser.email,
          name: swap.targetUser.name ?? "there",
          approved,
          requesterShift: reqShiftRow,
          targetShift: tgtShiftRow,
          isRequester: false,
          appUrl: APP_URL,
        }),
      ]).catch(() => {});
    }

    return NextResponse.json({ status: action === "approve" ? "APPROVED" : "REJECTED" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
