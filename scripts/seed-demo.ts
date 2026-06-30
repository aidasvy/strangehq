/**
 * Demo seed for aidas.vy@gmail.com
 * Run: npx tsx scripts/seed-demo.ts
 *
 * Creates: 5 employees, 4 weeks of approved time entries, published schedule,
 * next-week availability, holiday requests, payroll config, location.
 */

import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const db = new PrismaClient({ adapter });

// ── helpers ──────────────────────────────────────────────────────────────────

/** Monday 00:00 UTC for the week containing `ref`, offset by `delta` weeks */
function weekStart(delta = 0, ref = new Date()): Date {
  const d = new Date(ref);
  const dow = d.getUTCDay(); // 0=Sun
  const toMon = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + toMon + delta * 7);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Date object for a specific day within a week (dayIndex 0=Mon … 6=Sun) */
function dayOf(wStart: Date, dayIndex: number): Date {
  const d = new Date(wStart);
  d.setUTCDate(d.getUTCDate() + dayIndex);
  return d;
}

/**
 * Clock-in/out in UTC given a date and Lithuanian local times.
 * Lithuania is UTC+3 (EEST summer) / UTC+2 (EET winter).
 * June–July = EEST = UTC+3.
 */
function ltTime(date: Date, hh: number, mm = 0): Date {
  const d = new Date(date);
  d.setUTCHours(hh - 3, mm, 0, 0); // LT summer = UTC+3
  return d;
}

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── 1. find admin ──────────────────────────────────────────────────────────
  const adminUser = await db.user.findUnique({ where: { email: "aidas.vy@gmail.com" } });
  if (!adminUser) throw new Error("aidas.vy@gmail.com not found — has the account signed in at least once?");

  await db.user.update({
    where: { id: adminUser.id },
    data: { name: "Aidas Vyšniauskas", phone: "+370 600 12345" },
  });

  const adminMembership = await db.companyMember.findFirst({
    where: { userId: adminUser.id },
    include: { company: true },
  });
  if (!adminMembership) throw new Error("No company membership found for admin");

  const companyId = adminMembership.companyId;
  console.log(`✓ Company: ${adminMembership.company.name} (${companyId})`);

  // ── 3. payroll config ──────────────────────────────────────────────────────
  await db.payrollConfig.upsert({
    where: { companyId },
    update: {},
    create: {
      companyId,
      gpmRate: 0.20,
      gpmHighRate: 0.32,
      gpmAnnualThreshold: 101094,
      sodraEmployee: 0.1952,
      sodraEmployer: 0.0177,
      npdBase: 747,
      npdCoefficient: 0.49,
      minimumWage: 1038,
      nightPremium: 0.50,
      sundayPremium: 1.00,
      holidayPremium: 1.00,
    },
  });
  console.log("✓ Payroll config");

  // ── 4. location ───────────────────────────────────────────────────────────
  let location = await db.location.findFirst({ where: { companyId } });
  if (!location) {
    location = await db.location.create({
      data: {
        companyId,
        name: "Didžioji",
        address: "Didžioji g. 2, Vilnius",
        isActive: true,
      },
    });
  }
  const locationId = location.id;
  console.log(`✓ Location: ${location.name}`);

  // ── 5. employees ──────────────────────────────────────────────────────────
  const EMPLOYEES = [
    { name: "Mia Žukauskienė", email: "mia.z@strangelove.lt", phone: "+370 612 34567", role: "MANAGER", position: "Shift Manager", rate: 12.50 },
    { name: "Jonas Petraitis",  email: "jonas.p@strangelove.lt", phone: "+370 698 76543", role: "EMPLOYEE", position: "Barista", rate: 10.00 },
    { name: "Rūta Balčiūnaitė", email: "ruta.b@strangelove.lt", phone: "+370 655 11223", role: "EMPLOYEE", position: "Barista", rate: 10.50 },
    { name: "Tomas Kazlauskas", email: "tomas.k@strangelove.lt", phone: "+370 677 99887", role: "EMPLOYEE", position: "Barista", rate: 9.50 },
    { name: "Gabija Stankutė",  email: "gabija.s@strangelove.lt", phone: "+370 644 55667", role: "EMPLOYEE", position: "Barista", rate: 10.00 },
  ] as const;

  const empUsers: Array<{ id: string; name: string; email: string; memberId: string }> = [];

  for (const e of EMPLOYEES) {
    const user = await db.user.upsert({
      where: { email: e.email },
      update: { name: e.name, phone: e.phone },
      create: { email: e.email, name: e.name, phone: e.phone },
    });
    const member = await db.companyMember.upsert({
      where: { userId_companyId: { userId: user.id, companyId } },
      update: { role: e.role, position: e.position, hourlyRate: e.rate },
      create: { userId: user.id, companyId, role: e.role, position: e.position, hourlyRate: e.rate },
    });
    empUsers.push({ id: user.id, name: e.name, email: e.email, memberId: member.id });
    console.log(`  ✓ ${e.name} (${e.role})`);
  }

  // also update admin membership rate
  await db.companyMember.update({
    where: { id: adminMembership.id },
    data: { hourlyRate: 15.00, position: "Owner" },
  });

  const allEmpUsers = [
    { id: adminUser.id, name: "Aidas Vyšniauskas", memberId: adminMembership.id },
    ...empUsers,
  ];

  // ── 6. clear old demo data ────────────────────────────────────────────────
  await db.timeEntry.deleteMany({ where: { companyId } });
  await db.schedule.deleteMany({ where: { companyId } });
  await db.availability.deleteMany({ where: { companyId } });
  await db.holidayRequest.deleteMany({ where: { companyId } });
  console.log("✓ Cleared old entries");

  // ── 7. time entries — past 4 weeks (approved) ─────────────────────────────
  /**
   * Shift patterns per day (LT local time):
   * Morning: 07:00–15:00
   * Mid:     09:00–17:00
   * Evening: 13:00–21:00
   * Long:    07:00–16:00
   * Night:   16:00–22:30  (triggers night premium for last 30 min)
   */
  const SHIFTS = [
    { start: [7, 0],  end: [15, 0] },
    { start: [9, 0],  end: [17, 0] },
    { start: [13, 0], end: [21, 0] },
    { start: [7, 0],  end: [16, 0] },
    { start: [16, 0], end: [22, 30] }, // night premium
  ] as const;

  // each employee works ~5 days per week, different combos
  const WEEKLY_PATTERNS: Record<string, number[]> = {
    [adminUser.id]:       [0, 2, 4],          // Mon Wed Fri (admin works 3 days)
    [empUsers[0].id]: [0, 1, 2, 3, 4],        // Mia: Mon–Fri
    [empUsers[1].id]: [0, 1, 3, 5, 6],        // Jonas: Mon Tue Thu Sat Sun
    [empUsers[2].id]: [1, 2, 3, 4, 5],        // Rūta: Tue–Sat
    [empUsers[3].id]: [0, 2, 4, 5, 6],        // Tomas: Mon Wed Fri Sat Sun
    [empUsers[4].id]: [1, 3, 5, 6, 2],        // Gabija: Tue Thu Sat Sun Wed
  };

  // each employee prefers a shift time
  const PREFERRED_SHIFT: Record<string, number> = {
    [adminUser.id]:       1, // 09–17
    [empUsers[0].id]: 1,     // 09–17 (manager, mid-day)
    [empUsers[1].id]: 0,     // 07–15 (early)
    [empUsers[2].id]: 2,     // 13–21 (evening)
    [empUsers[3].id]: 4,     // 16–22:30 (night premium)
    [empUsers[4].id]: 3,     // 07–16
  };

  const timeEntries: Parameters<typeof db.timeEntry.create>[0]["data"][] = [];

  for (let weekDelta = -4; weekDelta <= -1; weekDelta++) {
    const wStart = weekStart(weekDelta);

    for (const u of allEmpUsers) {
      const days = WEEKLY_PATTERNS[u.id] ?? [0, 2, 4];
      const shiftIdx = PREFERRED_SHIFT[u.id] ?? 1;
      const shift = SHIFTS[shiftIdx];

      for (const dayIdx of days) {
        // skip ~15% randomly to make it realistic
        if (Math.random() < 0.15) continue;

        const date = dayOf(wStart, dayIdx);
        const clockIn  = ltTime(date, shift.start[0], shift.start[1]);
        const clockOut = ltTime(date, shift.end[0],   shift.end[1]);

        // add small random variation (±15 min)
        const jitter = (Math.floor(Math.random() * 7) - 3) * 5 * 60000;
        clockIn.setTime(clockIn.getTime() + jitter);
        clockOut.setTime(clockOut.getTime() + jitter);

        timeEntries.push({
          userId: u.id,
          companyId,
          locationId,
          clockIn,
          clockOut,
          status: "APPROVED",
          notes: null,
        });
      }
    }
  }

  await db.timeEntry.createMany({ data: timeEntries as Parameters<typeof db.timeEntry.createMany>[0]["data"] });
  console.log(`✓ ${timeEntries.length} approved time entries (4 weeks)`);

  // ── 8. this week — a few pending entries ──────────────────────────────────
  const thisWeek = weekStart(0);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const pendingEntries: Parameters<typeof db.timeEntry.createMany>[0]["data"] = [];

  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const date = dayOf(thisWeek, dayIdx);
    if (date > today) break; // don't create future entries

    for (const u of allEmpUsers) {
      const days = WEEKLY_PATTERNS[u.id] ?? [0, 2, 4];
      if (!days.includes(dayIdx)) continue;
      if (Math.random() < 0.2) continue; // some absent

      const shiftIdx = PREFERRED_SHIFT[u.id] ?? 1;
      const shift = SHIFTS[shiftIdx];
      const clockIn  = ltTime(date, shift.start[0], shift.start[1]);
      const clockOut = ltTime(date, shift.end[0],   shift.end[1]);

      pendingEntries.push({
        userId: u.id,
        companyId,
        locationId,
        clockIn,
        clockOut,
        status: "PENDING",
        notes: null,
      });
    }
  }

  await db.timeEntry.createMany({ data: pendingEntries });
  console.log(`✓ ${pendingEntries.length} pending entries (this week)`);

  // ── 9. published schedule — current week ──────────────────────────────────
  const currWeekStart = weekStart(0);

  const currSchedule = await db.schedule.create({
    data: {
      companyId,
      locationId,
      weekStart: currWeekStart,
      status: "PUBLISHED",
    },
  });

  // Build shift entries from WEEKLY_PATTERNS
  const scheduleShifts: Parameters<typeof db.scheduleShift.createMany>[0]["data"] = [];

  for (const u of allEmpUsers) {
    const days = WEEKLY_PATTERNS[u.id] ?? [0, 2, 4];
    const shiftIdx = PREFERRED_SHIFT[u.id] ?? 1;
    const shift = SHIFTS[shiftIdx];
    const startStr = `${String(shift.start[0]).padStart(2, "0")}:${String(shift.start[1]).padStart(2, "0")}`;
    const endStr   = `${String(shift.end[0]).padStart(2, "0")}:${String(shift.end[1]).padStart(2, "0")}`;

    for (const dayIdx of days) {
      const date = dayOf(currWeekStart, dayIdx);
      scheduleShifts.push({
        scheduleId: currSchedule.id,
        userId: u.id,
        date,
        startTime: startStr,
        endTime: endStr,
      });
    }
  }

  await db.scheduleShift.createMany({ data: scheduleShifts });
  console.log(`✓ Published schedule (${scheduleShifts.length} shifts)`);

  // ── 10. draft schedule — next week ────────────────────────────────────────
  const nextWeekStart = weekStart(1);

  const nextSchedule = await db.schedule.create({
    data: {
      companyId,
      locationId,
      weekStart: nextWeekStart,
      status: "DRAFT",
    },
  });

  const nextShifts: Parameters<typeof db.scheduleShift.createMany>[0]["data"] = [];

  for (const u of [empUsers[0], empUsers[1], empUsers[2]]) { // only 3 employees scheduled so far
    const days = WEEKLY_PATTERNS[u.id] ?? [0, 2, 4];
    const shiftIdx = PREFERRED_SHIFT[u.id] ?? 1;
    const shift = SHIFTS[shiftIdx];
    const startStr = `${String(shift.start[0]).padStart(2, "0")}:${String(shift.start[1]).padStart(2, "0")}`;
    const endStr   = `${String(shift.end[0]).padStart(2, "0")}:${String(shift.end[1]).padStart(2, "0")}`;

    for (const dayIdx of days) {
      const date = dayOf(nextWeekStart, dayIdx);
      nextShifts.push({
        scheduleId: nextSchedule.id,
        userId: u.id,
        date,
        startTime: startStr,
        endTime: endStr,
      });
    }
  }

  await db.scheduleShift.createMany({ data: nextShifts });
  console.log(`✓ Draft schedule next week (${nextShifts.length} shifts)`);

  // ── 11. availability — next week (4 of 5 employees submitted) ─────────────
  const availData = [
    { userId: empUsers[0].id, days: [0,1,2,3,4], start: "09:00", end: "17:00" },       // Mia: Mon–Fri
    { userId: empUsers[1].id, days: [0,1,3,5,6], start: "07:00", end: "15:00" },       // Jonas
    { userId: empUsers[2].id, days: [1,2,3,4,5], start: "13:00", end: "21:00" },       // Rūta
    { userId: empUsers[3].id, days: [0,2,4,5,6], start: "16:00", end: "22:30" },       // Tomas
    // Gabija hasn't submitted — will trigger "no availability" warning
  ];

  for (const av of availData) {
    await db.availability.create({
      data: {
        userId: av.userId,
        companyId,
        weekStart: nextWeekStart,
        data: av.days.map((day) => ({
          day: day + 1, // 1=Mon … 7=Sun
          startTime: av.start,
          endTime: av.end,
        })),
      },
    });
  }
  console.log("✓ Availability (4/5 employees submitted for next week)");

  // ── 12. holiday requests ──────────────────────────────────────────────────
  const nextMon  = dayOf(nextWeekStart, 0);
  const nextWed  = dayOf(nextWeekStart, 2);

  await db.holidayRequest.create({
    data: {
      userId: empUsers[1].id, // Jonas
      companyId,
      startDate: nextMon,
      endDate: nextWed,
      reason: "Family visit",
      status: "PENDING",
    },
  });

  // Rūta's request last month — approved
  const twoWeeksAgo = weekStart(-2);
  await db.holidayRequest.create({
    data: {
      userId: empUsers[2].id, // Rūta
      companyId,
      startDate: twoWeeksAgo,
      endDate: dayOf(twoWeeksAgo, 1),
      reason: "Doctor appointment",
      status: "APPROVED",
    },
  });

  // Gabija pending this week
  const thisMonday = weekStart(0);
  await db.holidayRequest.create({
    data: {
      userId: empUsers[4].id, // Gabija
      companyId,
      startDate: dayOf(thisMonday, 3),
      endDate: dayOf(thisMonday, 4),
      reason: "Personal",
      status: "PENDING",
    },
  });

  console.log("✓ Holiday requests (3 total: 2 pending, 1 approved)");

  console.log("\n🎉  Seed complete!");
  console.log(`    Company: ${adminMembership.company.name}`);
  console.log(`    Employees: ${allEmpUsers.length} total (including admin)`);
  console.log(`    Time entries: ${timeEntries.length + pendingEntries.length} total`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
