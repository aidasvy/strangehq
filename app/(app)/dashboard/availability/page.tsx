import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AvailabilityForm } from "./availability-form";
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "@/lib/i18n/translations";

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

  const locale = (await cookies()).get("locale")?.value ?? "lt";
  const t = getTranslations(locale);

  const sp = await searchParams;
  const weekOffset = Math.min(4, Math.max(1, parseInt(sp.week ?? "1") || 1));
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

  function weekDateRange(offset: number) {
    const start = getWeekStart(offset);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString(t.dateLocale, { day: "numeric", month: "short" });
    return `${fmt(start)} – ${fmt(end)}`;
  }

  return (
    <div className="p-6 space-y-6">
      <Link href="/dashboard" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">{t.common.backHome}</Link>
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{t.availability.title}</h1>
        <p className="text-sm text-stone-500">{t.availability.subtitle}</p>
      </div>

      {/* Week selector */}
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((offset) => {
          const active = weekOffset === offset;
          return (
            <Link
              key={offset}
              href={`/dashboard/availability?week=${offset}`}
              className={`rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
                active
                  ? "bg-stone-100 border-stone-400 text-stone-900"
                  : "border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              {weekDateRange(offset)}
            </Link>
          );
        })}
      </div>

      <AvailabilityForm
        companyId={membership.companyId}
        weekStart={weekStart.toISOString()}
        weekLabel={weekDateRange(weekOffset)}
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
