# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # start dev server (http://localhost:3000)
pnpm build      # production build
pnpm lint       # ESLint
```

No test suite is configured.

## Architecture

A single-page personal life-log dashboard. No authentication — runs on a private home LAN.

**Component layers:**

| Layer | Path | Role |
|---|---|---|
| UI (atomic) | `components/ui/` | shadcn/ui primitives — rarely edited directly |
| Dashboard (domain) | `components/dashboard/` | App-specific panels: KpiBoard, ActivityTimeline, AiFeedback, DetailPanel |
| Page | `app/page.tsx` | Orchestrates all data fetching and passes props down |

`app/page.tsx` is a `"use client"` component that owns all state. It fetches via `fetch()` in `useEffect`s and memoizes derived data with `useMemo`.

**API routes** (`app/api/`): server-side only, each connects directly to Trino.

- `/api/activities` — `life_gold.mrt_behavior_slots_15m` (15-min activity slots)
- `/api/bulk` — batches activities + meals + work for a date range
- `/api/fitness` — Fitbit data (steps, sleep, HR, calories)
- `/api/work` — PC work / dev scores
- `/api/meals` — meal records
- `/api/chat` — Gemini 2.0 Flash streaming via Vercel AI SDK

## Data Layer (Trino / Iceberg)

Connection config is read from `.env`:
```
TRINO_SERVER_URL=http://trino.mynet
TRINO_CATALOG=iceberg
TRINO_SCHEMA=life_gold
```

**Critical `trino-client` quirks:**
- `trino.query()` returns an `AsyncIterator<QueryResult>`. Iterate with `for await`.
- `result.data` is an array of positional arrays (not objects). Column order matches the SQL `SELECT` order — changing column order in the query requires updating index references in the mapping code.
- No auth configured on the Trino server; pass `user: "some-string"` to satisfy the client.

**Main table:** `life_gold.mrt_behavior_slots_15m`
- `time_slot_jst` / `time_slot_end_jst` — Timestamps (cast to VARCHAR, then parsed in JS)
- `cat_main` (Varchar) — primary category (SLEEP, WORK, DEVELOP, etc.)
- `cat_sub` (Varchar) — sub-category
- `overlap_sec` (BigInt) — seconds of activity in the slot
- All data is in **JST (Asia/Tokyo)**. Trino returns timestamps as strings; parse via `new Date(str.replace(" ", "T"))`.

Category classification logic lives in the dbt pipeline (`dbt_lifeos/models/intermediate/int_aw_categorized.sql`), not in this repo. New categories added there need a corresponding color entry in `components/dashboard/activity-timeline.tsx` → `activityConfig`.

**`cat_main` values (verified from live data):** `SLEEP`, `WORK`, `DEVELOP`, `READING`, `SOCIAL`, `MEDIA`, `MANGA`, `BROWSING`, `GAME`, `LIFE`, `EXERCISE`, `OUTING`, `BATH`, `UNKNOWN`, `UNOBSERVED`

**`time_slot_jst` / `time_slot_end_jst` are `timestamp(6)`** — the API casts them to VARCHAR. Do not remove this cast.

**Other Gold tables** (same Trino catalog `iceberg`, schema `life_gold`):

`mrt_fitness_daily_summary` — keyed on `target_date` (date):
- `steps` (integer), `calories_out` (integer), `calories_in` (double), `net_calorie_balance` (double)
- `activity_calories` (integer), `calories_bmr` (integer)
- `sedentary_minutes`, `lightly_active_minutes`, `fairly_active_minutes`, `very_active_minutes` (integer)
- `total_minutes_asleep` (integer), `total_time_in_bed` (integer)
- `sleep_deep_minutes`, `sleep_light_minutes`, `sleep_rem_minutes`, `sleep_wake_minutes` (integer)
- `resting_heart_rate` (integer), `weight_kg` (double, nullable), `body_fat_pct` (double), `bmi` (double)
- `activity_logs_str` (varchar), `weight_7d_avg` (double), `net_calorie_7d_avg` (double), `resting_hr_7d_avg` (double)
- Sleep efficiency is not stored — derive as `total_minutes_asleep / total_time_in_bed`

`mrt_aw_daily_work_summary` — keyed on `target_date` (date):
- `work_core_sec`, `work_session_sec` (bigint), `work_focus_rate` (integer, %), `work_score` (integer, 0–120)
- `work_apps_str` (varchar), `dev_core_sec`, `dev_session_sec` (bigint), `dev_focus_rate` (integer), `dev_score` (integer), `dev_apps_str` (varchar)

`mrt_asken` — keyed on `target_date` (date):
- `breakfast_items`, `lunch_items`, `dinner_items`, `snack_items` (varchar)
- `breakfast_calories`, `lunch_calories`, `dinner_calories`, `snack_calories` (double)
- `calories_kcal`, `protein_g`, `fat_g`, `carbs_g`, `fiber_g`, `salt_g`, `saturated_fat_g` (double)
- `potassium_mg`, `calcium_mg`, `iron_mg` (double)
- `vitamin_a_mcg`, `vitamin_e_mg`, `vitamin_b1_mg`, `vitamin_b2_mg`, `vitamin_b6_mg`, `vitamin_c_mg` (double)

## AI Integration

`app/api/chat/route.ts` uses `@ai-sdk/google` with `gemini-2.0-flash` and streams via `streamText`. Context data (KPIs, comparisons, insights) is built in `buildAiContext()` in `page.tsx` and sent as `body.contextData` alongside messages.

`useChat` from `@ai-sdk/react` is used in v5 API style: input state is managed manually; only `messages`, `sendMessage`, `status`, and `error` are extracted from the hook.

## Styling

Tailwind CSS 4 — **no `tailwind.config.js`**. Theme tokens are defined via `@theme` in `app/globals.css`.

Colors use **OKLCH** throughout (not HSL/RGB). Cyberpunk utility classes defined in `globals.css`:
- `.cyber-card` / `.cyber-card-green` — glassmorphism panels with neon glow
- `.neon-border-cyan`, `.glow-text-cyan` — neon accent effects

Layout: fixed two-column `30% / 70%` split with hardcoded `maxHeight` percentages per panel. Change column widths in the `w-[30%]` / `w-[70%]` divs in `page.tsx`.

## Data Pipeline Repository

Path: `/Users/tig/workspace/home_server/prefect-workflow/life_dashboard`

Medallion architecture: Bronze (S3/MinIO) → Silver → Intermediate → Gold, all stored as Iceberg tables on Trino.

**Orchestration:** Prefect flows on Kubernetes, running hourly:
- `:00` — Fitbit + ActivityWatch export
- `:10` — OwnTracks compaction
- `:30` — Asken scraping
- `:40` — dbt pipeline (silver → intermediate → gold)

**Data freshness:** Gold tables are typically 40–70 minutes behind real time.

**dbt project:** `dbt_lifeos/` inside the pipeline repo.
- `models/intermediate/int_aw_categorized.sql` — defines `cat_main`/`cat_sub` classification rules
- `models/gold/mrt_behavior_slots_15m.sql` — 15-min slot aggregation with priority-based winner selection
- `models/gold/mrt_aw_daily_work_summary.sql` — work/dev score formula (session detection + focus rate multiplier, cap 120pts)

**Sources ingested:**
- **Fitbit**: sleep stages, steps, HR (1-min intraday), calories, weight, BMI
- **ActivityWatch**: window events per device (MacBook personal/work, Windows gaming, Android)
- **Asken**: food/nutrition logging (web scraped from asken.jp)
- **OwnTracks**: GPS stay detection

**Infrastructure hostnames (LAN only):**
- Trino: `http://trino.mynet`
- ActivityWatch: `http://aw.mynet`
- MinIO: `http://minio.mynet`
