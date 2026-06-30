"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

interface Props {
  companyName: string;
  userName: string | null;
  userEmail: string;
  isAdmin: boolean;
  isFullAdmin: boolean;
}

export function SidebarNav({ companyName, userName, userEmail, isAdmin, isFullAdmin }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-stone-200 flex flex-col">
      <div className="px-4 py-5 border-b border-stone-100">
        <Link href="/dashboard" className="font-bold text-lg tracking-tight text-stone-900 hover:opacity-80 transition-opacity">
          Strange<span className="text-amber-600">HQ</span>
        </Link>
        <p className="text-xs text-stone-400 truncate mt-0.5">{companyName}</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <SectionLabel>Employee</SectionLabel>
        <NavLink href="/dashboard" exact pathname={pathname}>Home</NavLink>
        <NavLink href="/dashboard/hours" pathname={pathname}>Hours</NavLink>
        <NavLink href="/dashboard/schedule" pathname={pathname}>Schedule</NavLink>
        <NavLink href="/dashboard/availability" pathname={pathname}>Availability</NavLink>
        <NavLink href="/dashboard/holidays" pathname={pathname}>Holidays</NavLink>

        {isAdmin && (
          <>
            <div className="pt-3">
              <SectionLabel>Admin</SectionLabel>
            </div>
            <NavLink href="/admin" exact pathname={pathname}>Overview</NavLink>
            <NavLink href="/admin/schedule" pathname={pathname}>Schedule builder</NavLink>
            <NavLink href="/admin/time-entries" pathname={pathname}>Time entries</NavLink>
            <NavLink href="/admin/holidays" pathname={pathname}>Holidays</NavLink>
            <NavLink href="/admin/employees" pathname={pathname}>Employees</NavLink>
            <NavLink href="/admin/locations" pathname={pathname}>Locations</NavLink>
            {isFullAdmin && <NavLink href="/admin/payroll" pathname={pathname}>Payroll</NavLink>}
            <NavLink href="/admin/settings" pathname={pathname}>Settings</NavLink>
          </>
        )}
      </nav>

      <div className="px-4 py-4 border-t border-stone-100 space-y-1.5">
        <Link href="/dashboard/profile" className="block hover:opacity-80 transition-opacity">
          {userName && <p className="text-xs font-medium text-stone-700 truncate">{userName}</p>}
          <p className="text-xs text-stone-400 truncate">{userEmail}</p>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-1 pb-1 text-xs font-semibold text-stone-400 uppercase tracking-wider">
      {children}
    </p>
  );
}

function NavLink({
  href,
  pathname,
  exact,
  children,
}: {
  href: string;
  pathname: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const active = exact
    ? pathname === href
    : pathname === href || (pathname.startsWith(href + "/") && href !== "/dashboard" && href !== "/admin");

  return (
    <Link
      href={href}
      className={`flex items-center rounded-md py-2 text-sm transition-colors ${
        active
          ? "bg-amber-50 text-amber-900 font-medium border-l-2 border-amber-500 pl-[10px] pr-3"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 px-3"
      }`}
    >
      {children}
    </Link>
  );
}
