"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { useLocale } from "@/lib/i18n/context";
import { LocaleToggle } from "@/components/locale-toggle";

interface Props {
  companyName: string;
  userName: string | null;
  userEmail: string;
  isAdmin: boolean;
  isFullAdmin: boolean;
}

export function SidebarNav({ companyName, userName, userEmail, isAdmin, isFullAdmin }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useLocale();

  const employeeLinks = [
    { href: "/dashboard", label: t.nav.home, exact: true },
    { href: "/dashboard/hours", label: t.nav.hours },
    { href: "/dashboard/schedule", label: t.nav.schedule },
    { href: "/dashboard/availability", label: t.nav.availability },
    { href: "/dashboard/holidays", label: t.nav.holidays },
  ];

  const adminLinks = [
    { href: "/admin", label: t.nav.home, exact: true },
    { href: "/admin/schedule", label: t.nav.schedule },
    { href: "/admin/time-entries", label: t.adminTimeEntries.title },
    { href: "/admin/holidays", label: t.nav.holidays },
    { href: "/admin/employees", label: t.adminEmployees.title },
    { href: "/admin/locations", label: t.adminLocations.title },
    ...(isFullAdmin ? [{ href: "/admin/payroll", label: t.adminPayroll.title }] : []),
    { href: "/admin/settings", label: t.adminSettings.title },
  ];

  // Bottom tab items for mobile (most-used pages)
  const mobileTabs = [
    { href: "/dashboard", label: t.nav.home, exact: true },
    { href: "/dashboard/hours", label: t.nav.hours },
    { href: "/dashboard/schedule", label: t.nav.schedule },
    { href: "/dashboard/holidays", label: t.nav.leaveTab },
    ...(isAdmin ? [{ href: "/admin", label: t.nav.admin, exact: true }] : []),
  ];

  return (
    <>
      {/* ── DESKTOP SIDEBAR ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-56 shrink-0 bg-white border-r border-stone-200 flex-col">
        <div className="px-4 py-5 border-b border-stone-100">
          <Link href="/dashboard" className="font-bold text-lg tracking-tight text-stone-900 hover:opacity-80 transition-opacity">
            Strange<span className="text-stone-400">HQ</span>
          </Link>
          <p className="text-xs text-stone-400 truncate mt-0.5">{companyName}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <SectionLabel>{t.nav.employee}</SectionLabel>
          {employeeLinks.map((l) => (
            <NavLink key={l.href} href={l.href} pathname={pathname} exact={l.exact}>{l.label}</NavLink>
          ))}

          {isAdmin && (
            <>
              <div className="pt-3">
                <SectionLabel>{t.nav.admin}</SectionLabel>
              </div>
              {adminLinks.map((l) => (
                <NavLink key={l.href} href={l.href} pathname={pathname} exact={l.exact}>{l.label}</NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="px-4 py-4 border-t border-stone-100 space-y-2">
          <Link href="/dashboard/profile" className="block hover:opacity-80 transition-opacity">
            {userName && <p className="text-xs font-medium text-stone-700 truncate">{userName}</p>}
            <p className="text-xs text-stone-400 truncate">{userEmail}</p>
          </Link>
          <div className="flex items-center justify-between">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
            >
              {t.nav.signOut}
            </button>
            <LocaleToggle />
          </div>
        </div>
      </aside>

      {/* ── MOBILE HEADER ───────────────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-white border-b border-stone-200 flex items-center justify-between px-4 h-14">
        <Link href="/dashboard" className="font-bold text-lg tracking-tight text-stone-900">
          Strange<span className="text-stone-400">HQ</span>
        </Link>

        <div className="flex items-center gap-3">
          <LocaleToggle />
          {/* Hamburger — opens full menu overlay */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-2 rounded-md text-stone-600 hover:bg-stone-100 transition-colors"
            aria-label="Open menu"
          >
            {menuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h13a3 3 0 010 6h-1M16 8v8a3 3 0 01-3 3H6a3 3 0 01-3-3V8z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 2c0 .9.6 1-1 2.5M9 2c0 .9.6 1-1 2.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── MOBILE MENU OVERLAY ─────────────────────────────────────── */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-white overflow-y-auto pt-14 pb-20">
          <div className="px-4 py-4 border-b border-stone-100">
            <p className="text-xs text-stone-400">{companyName}</p>
          </div>

          <nav className="px-3 py-3 space-y-0.5">
            <SectionLabel>{t.nav.employee}</SectionLabel>
            {employeeLinks.map((l) => (
              <NavLink key={l.href} href={l.href} pathname={pathname} exact={l.exact} onClick={() => setMenuOpen(false)}>
                {l.label}
              </NavLink>
            ))}

            {isAdmin && (
              <>
                <div className="pt-3">
                  <SectionLabel>{t.nav.admin}</SectionLabel>
                </div>
                {adminLinks.map((l) => (
                  <NavLink key={l.href} href={l.href} pathname={pathname} exact={l.exact} onClick={() => setMenuOpen(false)}>
                    {l.label}
                  </NavLink>
                ))}
              </>
            )}
          </nav>

          <div className="px-4 py-4 mt-4 border-t border-stone-100 space-y-2">
            <Link href="/dashboard/profile" onClick={() => setMenuOpen(false)} className="block hover:opacity-80">
              {userName && <p className="text-sm font-medium text-stone-700">{userName}</p>}
              <p className="text-sm text-stone-400">{userEmail}</p>
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
            >
              {t.nav.signOut}
            </button>
          </div>
        </div>
      )}

      {/* ── MOBILE BOTTOM TAB BAR ───────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-stone-200 flex">
        {mobileTabs.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href + "/") || pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors ${
                active ? "text-stone-900" : "text-stone-400 hover:text-stone-700"
              }`}
            >
              <TabIcon href={tab.href} active={active} />
              <span className="mt-0.5 leading-tight">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function TabIcon({ href, active }: { href: string; active: boolean }) {
  const cls = `w-5 h-5 ${active ? "text-stone-900" : "text-stone-400"}`;
  if (href === "/dashboard") return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
  if (href === "/dashboard/hours") return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  if (href === "/dashboard/schedule") return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
  if (href === "/dashboard/holidays") return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
  // Admin
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-1 pb-1 text-xs font-semibold text-stone-400 uppercase tracking-wider">{children}</p>
  );
}

function NavLink({
  href, pathname, exact, children, onClick,
}: {
  href: string;
  pathname: string;
  exact?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const active = exact
    ? pathname === href
    : pathname === href || (pathname.startsWith(href + "/") && href !== "/dashboard" && href !== "/admin");

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center rounded-md py-2 text-sm transition-colors ${
        active
          ? "bg-stone-100 text-stone-900 font-medium border-l-2 border-stone-900 pl-[10px] pr-3"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 px-3"
      }`}
    >
      {children}
    </Link>
  );
}
