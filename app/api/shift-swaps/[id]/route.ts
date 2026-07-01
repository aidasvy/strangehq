import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  sendSwapPendingAdminEmail,
  sendSwapOutcomeEmail,
  ShiftRow,
} from "@/lib/email";
import { NextResponse } from "next/server";

const APP_URL = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "https://strangehq.app";

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

    const targetNewStatus = action === "accept" ? "PENDING_ADMIN" : "REJECTED";
    const { count } = await db.shiftSwapRequest.updateMany({
      where: { id, status: "PENDING_TARGET" },
      data: { status: targetNewStatus },
    });
    if (count === 0) {
      return NextResponse.json({ error: "Swap is not awaiting your response" }, { status: 409 });
    }

    if (action === "reject") {
      if (process.env.RESEND_API_KEY) {
        sendSwapOutcomeEmail({
          to: swap.requester.email,
          name: swap.requester.name ?? "there",
          approved: false,
          requesterShift: reqShiftRow,
          targetShift: tgtShiftRow,
          isRequester: true,
          appUrl: APP_URL,
        }).catch((err) => {
          console.error("[Shift Swaps] Failed to send rejection email:", err);
        });
      }

      return NextResponse.json({ status: "REJECTED" });
    }

    // Accepted → already moved to PENDING_ADMIN above; email admins
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
      ).catch((err) => {
        console.error("[Shift Swaps] Failed to send admin notification emails:", err);
      });
    }

    return NextResponse.json({ status: "PENDING_ADMIN" });
  }

  // ── Admin approves / denies ──────────────────────────────────────────────────
  if (action === "approve" || action === "deny") {
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const adminNewStatus = action === "approve" ? "APPROVED" : "REJECTED";

    // Guard the status transition with the WHERE clause (not a pre-check) so that
    // concurrent approve/deny calls on the same swap can't both proceed — Postgres
    // row locking on the UPDATE ensures only one of them matches PENDING_ADMIN.
    const claimed = await db.$transaction(async (tx) => {
      const { count } = await tx.shiftSwapRequest.updateMany({
        where: { id, status: "PENDING_ADMIN" },
        data: { status: adminNewStatus },
      });
      if (count === 0) return false;

      if (action === "approve") {
        // Swap the userId on both shifts now that the status transition is claimed
        await tx.scheduleShift.update({
          where: { id: swap.requesterShiftId },
          data: { userId: swap.targetUserId },
        });
        await tx.scheduleShift.update({
          where: { id: swap.targetShiftId },
          data: { userId: swap.requesterId },
        });
      }
      return true;
    });

    if (!claimed) {
      return NextResponse.json({ error: "Swap is not awaiting admin approval" }, { status: 409 });
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
      ]).catch((err) => {
        console.error("[Shift Swaps] Failed to send outcome emails:", err);
      });
    }

    return NextResponse.json({ status: action === "approve" ? "APPROVED" : "REJECTED" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
