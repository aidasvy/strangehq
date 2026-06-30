import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AvailabilityForm } from "./availability-form";
import Link from "next/link";

function getWeekStart(offsetWeeks: number): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) + 7 * offsetWeeks;
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
  });
  if (!membership) redirect("/onboarding");

  const sp = await searchParams;
  const weekOffset = sp.week === "2" ? 2 : 1;
  const weekStart = getWeekStart(weekOffset);

  const existing = await db.availability.findUnique({
    where: {
      userId_companyId_weekStart: {
        userId: session.user.id,
        companyId: membership.companyId,
        weekStart,
      },
    },
  });

  const weekLabel = weekOffset === 1 ? "Next week" : "Week after next";
  const weekDate = weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className="p-6 space-y-6">
      <Link href="/dashboard" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">← Home</Link>
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Availability</h1>
        <p className="text-sm text-stone-500">Let your manager know when you can work</p>
      </div>

      {/* Week selector */}
      <div className="flex gap-2">
        {[
          { label: "Next week", week: "1", offset: 1 },
          { label: "Week after", week: "2", offset: 2 },
        ].map(({ label, week, offset }) => {
          const active = weekOffset === offset;
          const date = getWeekStart(offset);
          return (
            <Link
              key={week}
              href={`/dashboard/availability?week=${week}`}
              className={`rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
                active
                  ? "bg-amber-50 border-amber-300 text-amber-900"
                  : "border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              {label}
              <span className="ml-1.5 text-xs font-normal opacity-60">
                {date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
            </Link>
          );
        })}
      </div>

      <AvailabilityForm
        companyId={membership.companyId}
        weekStart={weekStart.toISOString()}
        weekLabel={`${weekLabel} (w/c ${weekDate})`}
        existing={existing?.data as AvailabilitySlot[] | null}
      />
    </div>
  );
}

export interface AvailabilitySlot {
  day: number;
  startTime: string;
  endTime: string;
}
