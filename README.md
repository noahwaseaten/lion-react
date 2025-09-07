This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

# Push-ups Counter – Backend Provider Setup

This app can use either Google Sheets (Apps Script) or Supabase without changing the UI.

## Choose a provider

Set environment variable:

- DATA_PROVIDER=supabase (recommended)
- DATA_PROVIDER=sheets (or leave unset) to keep current Google Sheets backend

## Supabase setup (recommended)

1. Create a Supabase project.
2. In SQL Editor, create the table:

```sql
create extension if not exists pgcrypto;

create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  gender text not null check (gender in ('Men','Women')),
  count integer not null,
  age integer null,
  created_at timestamptz not null default now()
);

create index if not exists idx_attempts_gender_created_at on attempts(gender, created_at desc);
create index if not exists idx_attempts_count on attempts(count desc);
```

3. In your deployment env, set:

- SUPABASE_URL=... (Project URL)
- SUPABASE_SERVICE_ROLE_KEY=... (Service role key; server-only)
- DATA_PROVIDER=supabase

4. No UI changes are needed. Existing API routes now read/write Supabase when DATA_PROVIDER=supabase.

## Tunable client timings
You can tweak on-site without code changes:

- NEXT_PUBLIC_TOP5_SETTLE_MS (default 1200): delay to apply fresh data after Top 5 opens.
- NEXT_PUBLIC_PRESUBMIT_WINDOW_MS (default 3000): window to prefer pre-submit snapshot when opening Top 5.
- NEXT_PUBLIC_GENDER_LOADER_MIN_MS (default 500): minimum visibility for subtle loader when switching genders.

### Runtime overrides (no rebuild)
- URL params:
  - settle: override Top 5 settle window in ms (e.g., ?settle=1200)
  - pre: override pre-submit snapshot window in ms (e.g., ?pre=3000)
  - gloader: override min gender-switch loader ms (e.g., ?gloader=500)
  - preAlways: force using the pre-submit snapshot first when Top 5 opens if available (1/true/on or 0/false/off). Default: true
- LocalStorage keys (persist across reloads):
  - timing:settle, timing:pre, timing:gloader, timing:preAlways

Behavior:
- With preAlways enabled, if a submission just happened and a snapshot exists, the Top 5 first shows that snapshot to allow audience reaction, then applies fresh data after the settle window.

## Google Sheets (legacy)
If DATA_PROVIDER is not `supabase`, the app uses the existing Apps Script endpoints defined by `src/app/constants/sheet.ts`.

- Caching: the GET route mirrors Supabase cache semantics. By default it returns with `Cache-Control: s-maxage=300, stale-while-revalidate=60` so your CDN can cache for 5 minutes. If the client calls with `?nocache=true`, the route responds with `Cache-Control: no-store`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
