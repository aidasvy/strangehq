import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export default async function AppLayout({
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

  return <>{children}</>;
}
