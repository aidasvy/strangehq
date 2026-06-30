import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage = nextUrl.pathname.startsWith("/sign-in");
      const isApiAuth = nextUrl.pathname.startsWith("/api/auth");
      const isPublic = nextUrl.pathname === "/";
      const isOnboarding = nextUrl.pathname.startsWith("/onboarding");

      if (isApiAuth || isPublic) return true;
      if (isAuthPage) return isLoggedIn ? Response.redirect(new URL("/dashboard", nextUrl)) : true;
      if (isOnboarding) return isLoggedIn ? true : Response.redirect(new URL("/sign-in", nextUrl));
      return isLoggedIn ? true : false;
    },
  },
};
