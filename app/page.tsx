import Link from "next/link";

import { RuntimeModeBadge } from "@/components/dashboard/RuntimeModeBadge";
import { Button } from "@/components/ui/Button";

const features = [
  {
    title: "Five-step review flow",
    description:
      "The MVP connects document intake, clause extraction, risk scoring, suggestion generation, and report delivery in one guided path.",
  },
  {
    title: "Supabase-first backend contract",
    description:
      "The root Supabase Edge Functions remain the source of truth, and the frontend now matches their response model and naming.",
  },
  {
    title: "Mock and live runtime modes",
    description:
      "The app runs in demo mode when environment variables are missing, then switches to Supabase-backed requests as soon as they are configured.",
  },
];

const screens = [
  "Landing",
  "Auth",
  "Dashboard",
  "Upload",
  "Analysis Progress",
  "Risk Report",
];

export default function HomePage() {
  return (
    <main>
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <RuntimeModeBadge />
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-blue-700">
            ClauseGuard Reorg
          </p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
            ClauseGuard is now organized as a runnable contract review MVP.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            The PRD stays as the planning source, the root Supabase functions stay as the backend source of truth,
            and the donor frontend pieces have been consolidated into one Next.js app that covers the path from sign-in
            to contract analysis report.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/auth">
              <Button size="lg">Open auth flow</Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="lg">
                Preview dashboard
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-xl shadow-slate-200/60">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">MVP Flow</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">
                  Landing {"->"} Auth {"->"} Upload {"->"} Analysis {"->"} Report
                </p>
              </div>
              <div className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Root App Ready</div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {screens.map((screen, index) => (
                <div key={screen} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step {index + 1}</p>
                  <p className="mt-2 text-lg font-medium text-slate-950">{screen}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-8 text-white shadow-xl shadow-slate-300/20">
            <p className="text-sm font-medium text-sky-300">What changed</p>
            <ul className="mt-6 space-y-4 text-sm leading-7 text-slate-200">
              <li>The root app now hosts the Next.js runtime instead of splitting code across donor folders.</li>
              <li>The frontend data model follows the Supabase backend contract and uses snake_case field names.</li>
              <li>A mock workspace keeps the core user flow testable even before environment variables are configured.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">{feature.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
