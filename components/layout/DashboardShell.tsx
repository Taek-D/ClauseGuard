"use client";

import Link from "next/link";

import { useAuthStore } from "@/store/useAuthStore";

import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.is_loading);
  const initialized = useAuthStore((state) => state.initialized);
  const enterDemo = useAuthStore((state) => state.enter_demo);

  if (!initialized || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" label="워크스페이스를 준비하는 중입니다..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <div className="rounded-3xl border border-white/70 bg-white/90 p-10 shadow-xl shadow-slate-200/60">
          <p className="text-sm font-semibold text-blue-600">Protected Workspace</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">먼저 로그인해 주세요</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            루트 앱은 준비되었지만 현재 세션이 없습니다. 인증 페이지로 이동하거나 데모 워크스페이스를 바로 열 수 있습니다.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/auth">
              <Button size="lg">인증 페이지로 이동</Button>
            </Link>
            <Button variant="outline" size="lg" onClick={() => void enterDemo()}>
              데모로 바로 시작
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto flex max-w-7xl">
        <Sidebar />
        <main className="min-h-[calc(100vh-4rem)] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
