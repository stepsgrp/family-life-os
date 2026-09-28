"use client";

import { UserButton } from "@clerk/nextjs";
import { useFamilyRealtime } from "@flos/api-client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useFamily } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";

const NAV = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/grocery", label: "Grocery", icon: "🛒" },
  { href: "/meals", label: "Meals", icon: "🍽️" },
  { href: "/chores", label: "Chores", icon: "🧹" },
  { href: "/reminders", label: "Reminders", icon: "💊" },
  { href: "/ai", label: "AI helpers", icon: "✨" },
  { href: "/vacations", label: "Vacations", icon: "🏖️" },
  { href: "/documents", label: "Documents", icon: "📁", parentsOnly: true },
  { href: "/contacts", label: "Emergency", icon: "🚑" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, family, me, isParent } = useFamily();
  const router = useRouter();
  const pathname = usePathname();

  // Live updates from other family members.
  useFamilyRealtime(supabase, family?.id);

  useEffect(() => {
    if (!isLoading && !me) router.replace("/onboarding");
  }, [isLoading, me, router]);

  if (isLoading || !me) {
    return <div className="flex min-h-screen items-center justify-center text-ink-500">Loading your family…</div>;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-ink-300/50 bg-white p-4 md:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 px-2">
          <p className="text-xs uppercase tracking-wide text-ink-500">Family Life OS</p>
          <p className="truncate font-semibold">{family?.name}</p>
        </div>
        <nav className="flex-1 space-y-0.5">
          {NAV.filter((n) => !n.parentsOnly || isParent).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
                pathname.startsWith(n.href)
                  ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-700/20 dark:text-brand-100"
                  : "text-ink-700 hover:bg-ink-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <span>{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-ink-100 px-2 pt-4 dark:border-slate-800">
          <UserButton />
          <span className="truncate text-sm">{me.displayName}</span>
        </div>
      </aside>

      {/* Mobile web: bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-ink-300/50 bg-white py-2 md:hidden dark:border-slate-800 dark:bg-slate-900">
        {NAV.slice(0, 5).map((n) => (
          <Link key={n.href} href={n.href} className="flex flex-col items-center text-[11px]">
            <span className="text-lg">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>

      <main className="min-w-0 flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10">{children}</main>
    </div>
  );
}
