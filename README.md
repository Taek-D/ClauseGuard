# ClauseGuard

ClauseGuard is now organized as a single root Next.js app with the Supabase backend kept at the repository root.

## Runtime

- Default mode: mock workspace
- Live mode: configure the values in `.env.example`

## Commands

```bash
npm install
npm run build
npm run dev
npx playwright install chromium
npm run test:e2e
npm run deno:test
npm run deno:check
```

## CI

- GitHub Actions runs build, Playwright smoke tests, and Deno verification from [ci.yml](/E:/프로젝트/ClauseGuard/.github/workflows/ci.yml)
- Recommended required checks:
  - `Build`
  - `Mock E2E`
  - `Deno Test`
  - `Deno Check`
- GitHub may display these under the workflow name as `CI / Build`, `CI / Mock E2E`, `CI / Deno Test`, and `CI / Deno Check`

## Structure

- `app/`: Next.js routes for landing, auth, dashboard, upload, analysis, and report views
- `components/`: shared UI and feature components
- `lib/`: runtime helpers, Supabase client setup, mock adapter, API adapter
- `store/`: Zustand state for auth and contracts
- `types/`: frontend types aligned to the Supabase contract
- `supabase/`: Edge Functions and SQL migrations
- `archive/legacy-reorg-20260317/`: donor folders moved out of the active runtime tree
