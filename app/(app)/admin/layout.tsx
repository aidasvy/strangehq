import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const membership = await db.companyMember.findFirst({
    where: { userId: session.user.id },
  });

  if (!membership) redirect("/onboarding");
  if (membership.role !== "ADMIN" && membership.role !== "MANAGER") redirect("/dashboard");

  return <>{children}</>;
}
