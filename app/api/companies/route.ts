import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const ALLOWED_EMAILS = (process.env.ALLOWED_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = session.user.email?.toLowerCase() ?? "";
  if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(email)) {
    return NextResponse.json({ error: "Not authorised to create a company" }, { status: 403 });
  }

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Company name is required" }, { status: 400 });

  const existing = await db.companyMember.findFirst({ where: { userId: session.user.id } });
  if (existing) return NextResponse.json({ error: "You already belong to a company" }, { status: 400 });

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString(36);

  const company = await db.company.create({
    data: {
      name: name.trim(),
      slug,
      members: {
        create: { userId: session.user.id, role: "ADMIN" },
      },
      locations: {
        create: { name: "Main Location" },
      },
    },
  });

  return NextResponse.json(company, { status: 201 });
}
