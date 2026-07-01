import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "ShiftSync <noreply@shiftsync.app>";

export type ShiftRow = {
  date: Date;
  startTime: string;
  endTime: string;
  locationName: string;
};

function weekRangeLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  return `${fmt(weekStart)} – ${fmt(end)}`;
}

function scheduleTable(shifts: ShiftRow[]): string {
  if (shifts.length === 0) {
    return `<p style="color:#78716c;font-size:14px;">No shifts scheduled for this week.</p>`;
  }
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const rows = shifts
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((s) => {
      const dow = ((s.date.getDay() + 6) % 7); // 0=Mon
      const label = days[dow];
      const dateStr = s.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      return `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #e7e5e4;font-weight:600;color:#1c1917;">${label} ${dateStr}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #e7e5e4;color:#44403c;">${s.startTime} – ${s.endTime}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #e7e5e4;color:#78716c;">${s.locationName}</td>
        </tr>`;
    })
    .join("");

  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background:#f5f5f4;">
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#78716c;">Day</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#78716c;">Hours</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#78716c;">Location</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function wrapper(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border:1px solid #e7e5e4;border-radius:8px;overflow:hidden;">
    <div style="background:#1c1917;padding:20px 24px;">
      <span style="color:#fff;font-weight:700;font-size:16px;letter-spacing:-.01em;">ShiftSync</span>
    </div>
    <div style="padding:28px 24px;">
      <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1c1917;">${title}</h2>
      ${body}
    </div>
    <div style="padding:16px 24px;background:#fafaf9;border-top:1px solid #e7e5e4;">
      <p style="margin:0;font-size:12px;color:#a8a29e;">You're receiving this because you're part of a company on ShiftSync.</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendSchedulePublishedEmail({
  to,
  name,
  weekStart,
  shifts,
  appUrl,
}: {
  to: string;
  name: string;
  weekStart: Date;
  shifts: ShiftRow[];
  appUrl: string;
}) {
  const week = weekRangeLabel(weekStart);
  const body = `
    <p style="color:#44403c;font-size:14px;margin:0 0 20px;">Hi ${name}, your schedule for <strong>${week}</strong> has been published.</p>
    ${scheduleTable(shifts)}
    <p style="margin:24px 0 0;">
      <a href="${appUrl}/dashboard/schedule" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">View in app →</a>
    </p>`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your schedule for ${week}`,
    html: wrapper(`Schedule: ${week}`, body),
  });
}

export async function sendSwapRequestedEmail({
  to,
  targetName,
  requesterName,
  requesterShift,
  targetShift,
  swapId,
  appUrl,
}: {
  to: string;
  targetName: string;
  requesterName: string;
  requesterShift: ShiftRow;
  targetShift: ShiftRow;
  swapId: string;
  appUrl: string;
}) {
  const fmt = (s: ShiftRow) =>
    `${s.date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} ${s.startTime}–${s.endTime} @ ${s.locationName}`;

  const body = `
    <p style="color:#44403c;font-size:14px;margin:0 0 20px;">Hi ${targetName}, <strong>${requesterName}</strong> would like to swap shifts with you.</p>
    <div style="background:#f5f5f4;border-radius:6px;padding:16px;margin-bottom:20px;font-size:14px;">
      <p style="margin:0 0 8px;color:#78716c;">Their shift (they give up):</p>
      <p style="margin:0 0 16px;font-weight:600;color:#1c1917;">${fmt(requesterShift)}</p>
      <p style="margin:0 0 8px;color:#78716c;">Your shift (you give up):</p>
      <p style="margin:0;font-weight:600;color:#1c1917;">${fmt(targetShift)}</p>
    </div>
    <p style="margin:0 0 16px;font-size:14px;color:#44403c;">Open the app to accept or decline:</p>
    <p style="margin:0;">
      <a href="${appUrl}/dashboard/schedule" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">Respond to request →</a>
    </p>`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Shift swap request from ${requesterName}`,
    html: wrapper("Shift swap request", body),
  });
}

export async function sendSwapPendingAdminEmail({
  to,
  adminName,
  requesterName,
  targetName,
  requesterShift,
  targetShift,
  appUrl,
}: {
  to: string;
  adminName: string;
  requesterName: string;
  targetName: string;
  requesterShift: ShiftRow;
  targetShift: ShiftRow;
  appUrl: string;
}) {
  const fmt = (s: ShiftRow) =>
    `${s.date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} ${s.startTime}–${s.endTime} @ ${s.locationName}`;

  const body = `
    <p style="color:#44403c;font-size:14px;margin:0 0 20px;">Hi ${adminName}, a shift swap needs your approval.</p>
    <div style="background:#f5f5f4;border-radius:6px;padding:16px;margin-bottom:20px;font-size:14px;">
      <p style="margin:0 0 8px;color:#78716c;">${requesterName} takes:</p>
      <p style="margin:0 0 16px;font-weight:600;color:#1c1917;">${fmt(targetShift)}</p>
      <p style="margin:0 0 8px;color:#78716c;">${targetName} takes:</p>
      <p style="margin:0;font-weight:600;color:#1c1917;">${fmt(requesterShift)}</p>
    </div>
    <p style="margin:0;">
      <a href="${appUrl}/admin/swap-requests" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">Review swap →</a>
    </p>`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Shift swap approval needed: ${requesterName} ↔ ${targetName}`,
    html: wrapper("Shift swap needs approval", body),
  });
}

export async function sendSwapOutcomeEmail({
  to,
  name,
  approved,
  requesterShift,
  targetShift,
  isRequester,
  appUrl,
}: {
  to: string;
  name: string;
  approved: boolean;
  requesterShift: ShiftRow;
  targetShift: ShiftRow;
  isRequester: boolean;
  appUrl: string;
}) {
  const fmt = (s: ShiftRow) =>
    `${s.date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} ${s.startTime}–${s.endTime} @ ${s.locationName}`;

  const newShift = isRequester ? targetShift : requesterShift;
  const status = approved ? "approved" : "rejected";
  const body = approved
    ? `<p style="color:#44403c;font-size:14px;margin:0 0 20px;">Hi ${name}, your shift swap was <strong>approved</strong>. Your new shift:</p>
       <div style="background:#f5f5f4;border-radius:6px;padding:16px;margin-bottom:20px;font-size:14px;font-weight:600;color:#1c1917;">${fmt(newShift)}</div>
       <a href="${appUrl}/dashboard/schedule" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">View schedule →</a>`
    : `<p style="color:#44403c;font-size:14px;margin:0 0 20px;">Hi ${name}, your shift swap was <strong>not approved</strong>. Your original shift remains unchanged.</p>
       <a href="${appUrl}/dashboard/schedule" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">View schedule →</a>`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Shift swap ${status}`,
    html: wrapper(`Shift swap ${status}`, body),
  });
}
