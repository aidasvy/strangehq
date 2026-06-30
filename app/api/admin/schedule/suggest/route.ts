import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership || (membership.role !== "ADMIN" && membership.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { companyId, locationId, locationName, weekStart, employees, existingShifts, crossLocationShifts } = await req.json();

  if (companyId !== membership.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch staffing rules and location hours for this location + all other locations company-wide
  const [staffingRules, locationHours, otherLocations] = await Promise.all([
    db.staffingRule.findMany({ where: { locationId } }),
    db.locationHours.findMany({ where: { locationId } }),
    db.location.findMany({
      where: { companyId, id: { not: locationId }, isActive: true },
      include: { staffingRules: true, locationHours: true },
    }),
  ]);

  // Build week date strings
  const ws = new Date(weekStart);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const prompt = `You are a shift scheduling assistant for a Lithuanian café/restaurant called "${locationName}".

Today is ${new Date().toISOString().slice(0, 10)}.
You are building a schedule for the week of ${weekStart.slice(0, 10)} (Mon ${weekDates[0]} → Sun ${weekDates[6]}).

## Employees and availability
${employees.map((e: { id: string; name: string; availability: unknown; monthlyApprovedHours: number; monthlyScheduledHours: number }) => {
  const avail = Array.isArray(e.availability) ? e.availability : [];
  const availStr = avail.length === 0
    ? "No availability submitted"
    : avail.map((a: { day: number; startTime: string; endTime: string }) => `${DAYS[a.day - 1]}: ${a.startTime}–${a.endTime}`).join(", ");
  const crossShifts = (crossLocationShifts as Array<{ userId: string; date: string; locationName: string; startTime: string; endTime: string }>)
    .filter((cs) => cs.userId === e.id);
  const blockedDates = crossShifts.map((cs) => `  - BLOCKED ${cs.date} (${cs.startTime}–${cs.endTime} at ${cs.locationName}) — DO NOT schedule at ${locationName} on this date`).join("\n");
  return `- ${e.name} (id: ${e.id}): available: ${availStr}; this month: ${e.monthlyApprovedHours}h approved, ${e.monthlyScheduledHours}h scheduled${blockedDates ? `\n${blockedDates}` : ""}`;
}).join("\n")}

## HARD RULE — same-day conflicts
The following dates are completely blocked for these employees — they already have a shift at another location. You MUST NOT generate any shift for them on these dates, no exceptions:
${(() => {
  const blocked = (crossLocationShifts as Array<{ userId: string; date: string; locationName: string; startTime: string; endTime: string }>);
  if (blocked.length === 0) return "None — no cross-location conflicts this week.";
  return blocked.map((cs) => {
    const emp = (employees as Array<{ id: string; name: string }>).find((e) => e.id === cs.userId);
    return `- ${emp?.name ?? cs.userId} on ${cs.date}: occupied at ${cs.locationName} (${cs.startTime}–${cs.endTime})`;
  }).join("\n");
})()}

## Location hours
${locationHours.length === 0
  ? "Mon–Sun: 09:00–22:00"
  : locationHours.map((lh) => `${DAYS[lh.dayOfWeek - 1]}: ${lh.isOpen ? `${lh.openTime}–${lh.closeTime}` : "CLOSED"}`).join(", ")}

## Minimum staffing rules
${staffingRules.length === 0
  ? "No specific rules — aim for at least 2 staff per open day."
  : staffingRules.map((r) => `${DAYS[r.dayOfWeek - 1]} at ${r.hour}:00 → min ${r.minStaff} staff`).join(", ")}

## Other company locations this week (for allocation context — do NOT generate shifts for these)
${otherLocations.length === 0
  ? "None — this is the only location."
  : otherLocations.map((loc) => {
      const hours = loc.locationHours.length === 0
        ? "Mon–Sun: 09:00–22:00 (default)"
        : loc.locationHours.map((lh) => `${DAYS[lh.dayOfWeek - 1]}: ${lh.isOpen ? `${lh.openTime}–${lh.closeTime}` : "CLOSED"}`).join(", ");
      const rules = loc.staffingRules.length === 0
        ? "no specific rules (aim for 2+ staff per open day)"
        : loc.staffingRules.map((r) => `${DAYS[r.dayOfWeek - 1]} at ${r.hour}:00 → min ${r.minStaff} staff`).join(", ");
      const committed = (crossLocationShifts as Array<{ userId: string; date: string; startTime: string; endTime: string; locationName: string }>)
        .filter((cs) => cs.locationName === loc.name);
      const committedStr = committed.length === 0
        ? "no shifts committed yet"
        : committed.map((cs) => {
            const emp = (employees as Array<{ id: string; name: string }>).find((e) => e.id === cs.userId);
            return `${emp?.name ?? cs.userId} on ${cs.date} ${cs.startTime}–${cs.endTime}`;
          }).join(", ");
      return `### ${loc.name}\n- Hours: ${hours}\n- Staffing rules: ${rules}\n- Already committed: ${committedStr}`;
    }).join("\n\n")}

Use this context to avoid over-allocating employees who are already committed at other locations, and to prioritise employees where their absence would leave another location under-staffed.

## Existing shifts this week (already scheduled at this location — keep or adjust if needed)
${(existingShifts as Array<{ userId: string; date: string; startTime: string; endTime: string }>).length === 0
  ? "None"
  : (existingShifts as Array<{ userId: string; date: string; startTime: string; endTime: string }>).map((s) => {
      const emp = (employees as Array<{ id: string; name: string }>).find((e) => e.id === s.userId);
      return `${emp?.name ?? s.userId} on ${s.date}: ${s.startTime}–${s.endTime}`;
    }).join("\n")}

## Your task
Create an optimal schedule for this week. Rules:
- Only schedule employees on days they are available (skip employees with no availability)
- Respect their availability time windows — shift must fit within their available hours
- Do not exceed 8h per shift or 40h per week per person
- Do not double-book anyone at two locations at the same time
- Distribute hours fairly — prefer employees with fewer monthly hours so far
- Ensure each open day has enough coverage (at least 2 people, or 1 if very small team)
- A person can work at multiple locations on different days — that's fine

Respond with ONLY valid JSON in this exact format, no explanation:
{
  "shifts": [
    { "userId": "<id>", "date": "<YYYY-MM-DD>", "startTime": "<HH:MM>", "endTime": "<HH:MM>" }
  ]
}`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "Could not parse AI response" }, { status: 500 });

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.shifts)) return NextResponse.json({ error: "Invalid AI response format" }, { status: 500 });

    // Validate shift dates are in the week
    const validDates = new Set(weekDates);
    const validUserIds = new Set((employees as Array<{ id: string }>).map((e) => e.id));
    const validShifts = parsed.shifts.filter(
      (s: { userId: string; date: string; startTime: string; endTime: string }) =>
        validDates.has(s.date) && validUserIds.has(s.userId) && s.startTime && s.endTime
    );

    return NextResponse.json({ shifts: validShifts.map((s: { userId: string; date: string; startTime: string; endTime: string }) => ({
      userId: s.userId,
      date: new Date(s.date).toISOString(),
      startTime: s.startTime,
      endTime: s.endTime,
    })) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("AI suggest error:", message);
    return NextResponse.json({ error: `AI suggestion failed: ${message}` }, { status: 500 });
  }
}
