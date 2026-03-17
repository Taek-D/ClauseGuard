"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { RuntimeModeBadge } from "@/components/dashboard/RuntimeModeBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuthStore } from "@/store/useAuthStore";

export default function AuthPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const error = useAuthStore((state) => state.error);
  const isLoading = useAuthStore((state) => state.is_loading);
  const runtimeMode = useAuthStore((state) => state.runtime_mode);
  const signIn = useAuthStore((state) => state.sign_in);
  const signInWithGoogle = useAuthStore((state) => state.sign_in_with_google);
  const enterDemo = useAuthStore((state) => state.enter_demo);
  const clearError = useAuthStore((state) => state.clear_error);

  const [email, setEmail] = useState("founder@clauseguard.app");
  const [password, setPassword] = useState("demo-password");

  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [router, user]);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid w-full gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-xl shadow-slate-200/60">
          <RuntimeModeBadge />
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950">ClauseGuard 인증</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Supabase가 설정된 경우 실제 인증 세션을 사용하고, 그렇지 않으면 demo 워크스페이스를 만들어 바로 대시보드로 이동합니다.
          </p>
          <div className="mt-8 rounded-2xl bg-slate-950 p-5 text-sm leading-7 text-slate-200">
            <p className="font-medium text-white">이 화면에서 확인할 수 있는 것</p>
            <ul className="mt-3 space-y-2">
              <li>이메일 로그인 또는 Google OAuth 버튼</li>
              <li>Mock / Supabase 런타임 표시</li>
              <li>로그인 후 대시보드 리다이렉션</li>
            </ul>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white/95 p-8 shadow-xl shadow-slate-200/60">
          <form
            className="space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              clearError();
              const success = await signIn(email, password);
              if (success) {
                router.push("/dashboard");
              }
            }}
          >
            <div>
              <p className="text-sm font-medium text-slate-500">Sign in</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">워크스페이스에 들어가기</h2>
            </div>

            <Input
              label="이메일"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              label="비밀번호"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              hint="Mock 모드에서는 어떤 값이든 데모 세션으로 이어집니다."
            />

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3">
              <Button type="submit" size="lg" isLoading={isLoading}>
                이메일로 계속
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={async () => {
                  clearError();
                  const success = await signInWithGoogle();
                  if (success && runtimeMode === "mock") {
                    router.push("/dashboard");
                  }
                }}
              >
                Google로 계속
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={async () => {
                  const success = await enterDemo();
                  if (success) {
                    router.push("/dashboard");
                  }
                }}
              >
                데모 워크스페이스 열기
              </Button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
