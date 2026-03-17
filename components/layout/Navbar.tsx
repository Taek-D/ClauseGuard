"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { RuntimeModeBadge } from "@/components/dashboard/RuntimeModeBadge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { PLAN_LABELS } from "@/types";
import { useAuthStore } from "@/store/useAuthStore";

const NAV_LINKS = [
  { href: "/dashboard", label: "개요", exact: true },
  { href: "/dashboard/contracts", label: "보관함", exact: false },
  { href: "/dashboard/upload", label: "업로드", exact: false },
];

export function Navbar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.sign_out);

  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-600 text-sm font-semibold text-white shadow-sm">
              CG
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">ClauseGuard</p>
              <p className="text-xs text-slate-500">Supabase-first MVP</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((item) => {
              const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <RuntimeModeBadge />
          {user ? (
            <>
              <div className="hidden text-right md:block">
                <p className="text-sm font-medium text-slate-950">{user.name}</p>
                <p className="text-xs text-slate-500">
                  {user.organization_name} · {PLAN_LABELS[user.plan]}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>
                로그아웃
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
