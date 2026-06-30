import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { InviteCodeManager } from "./invite-code-manager";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
    include: { company: true },
  });
  if (!membership) redirect("/onboarding");

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
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Settings</h1>
        <p className="text-sm text-stone-500">{membership.company.name}</p>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-stone-900">Invite codes</h2>
        <p className="text-sm text-stone-500">
          Generate codes to share with employees. They sign in with Google and enter the code to join.
        </p>
        <InviteCodeManager companyId={membership.companyId} codes={codes} />
      </div>
    </div>
  );
}
