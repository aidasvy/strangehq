import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/sidebar-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
    include: { company: true },
  });
  if (!membership) redirect("/onboarding");

  return (
    <div className="min-h-screen flex">
      <SidebarNav
        companyName={membership.company.name}
        userName={session.user.name ?? null}
        userEmail={session.user.email ?? ""}
        isAdmin={membership.role === "ADMIN" || membership.role === "MANAGER"}
        isFullAdmin={membership.role === "ADMIN"}
      />
      <main className="flex-1 overflow-auto pt-14 pb-20 lg:pt-0 lg:pb-0">{children}</main>
    </div>
  );
}
