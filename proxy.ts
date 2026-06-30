import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

// Auth.js v5 auth() is edge-safe when used without the DB adapter.
// It reads the JWT session from the cookie and runs the authorized() callback.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const proxy = auth as any;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
