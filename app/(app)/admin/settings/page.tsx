import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { InviteCodeManager } from "./invite-code-manager";
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "@/lib/i18n/translations";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
    include: { company: true },
  });
  if (!membership) redirect("/onboarding");

  const locale = (await cookies()).get("locale")?.value ?? "lt";
  const t = getTranslations(locale);

  const inviteCodes = await db.inviteCode.findMany({
    where: { companyId: membership.companyId },
    orderBy: { createdAt: "desc" },
  });

  const codes = inviteCodes.map((c) => ({
    id: c.id,
    code: c.code,
    role: c.role,
    usedCount: c.usedCount,
    maxUses: c.maxUses,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="p-6 space-y-6">
      <Link href="/admin" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">{t.common.backOverview}</Link>
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{t.adminSettings.title}</h1>
        <p className="text-sm text-stone-500">{membership.company.name}</p>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-stone-900">{t.adminSettings.inviteCodes}</h2>
        <p className="text-sm text-stone-500">{t.adminSettings.inviteDesc}</p>
        <InviteCodeManager companyId={membership.companyId} codes={codes} />
      </div>
    </div>
  );
}
