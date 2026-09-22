# 3AKNAFA LEAGUE

A private PlayStation FIFA/EA FC league manager for the squad. Record matches,
and everything else — points, wins, losses, win rates, standings, monthly
awards and history — is calculated automatically.

Built with **Next.js (App Router) + TypeScript + Tailwind CSS + SQLite
(better-sqlite3)**. One app serves the site, the JSON API, and the database.

---

## Quick start

```bash
npm install
npm run build
npm run start        # production → http://localhost:3000
```

Development:

```bash
npm run dev          # dev server with hot reload
npx tsx scripts/verify.mts   # statistics engine test suite (46 checks)
```

**Default admin login:** `admin` / `fifa123` — change it in **Settings** on
first use. Everyone else can browse everything without an account; only
mutations (record/edit/delete matches, manage players, change settings)
require an admin session.

The SQLite database is created and seeded automatically at `data/league.db`
on first run with the 10 real players and their photos (`public/players/`).
The league starts with **zero matches** — record real results from your
gatherings and every table, chart and award updates itself. The season runs
September 2026 → September 2027 (the month filter covers the whole season).
Delete the `data/` folder to reset to the fresh player roster.

---

## The rules the engine implements

| Format | Match count | Winner points | Loser points |
| --- | --- | --- | --- |
| Single Match (1v1) | 1 | +1 | 0 |
| Best of 3 (1v1 series) | **1 series = 1 match** | +2 | 0 |
| Multiplayer (2v2+) | 1 per player | +1 each | 0 |
| Multiplayer Best of 3 | 1 series per player | +2 each | 0 |

All point values are configurable in **Settings** and apply instantly.

**Win percentage** = wins / matches played × 100 (shown with one decimal,
kept at full precision for ranking).

**Standings** rank by league points → win rate → wins → matches played.
Players identical on all four share a rank (`=`).

**Monthly awards** use win rate — never points — among players who meet the
minimum monthly matches (default 5, configurable):

- 🏆 Best Player of the Month = highest qualifying win rate
- 💀 Worst Player of the Month = lowest qualifying win rate
- Tie-breakers: more wins → more matches → more points → still identical = a tie
- A player with 4 matches and 0% does **not** qualify over a player with 10
  matches and 20%.

Monthly history is permanent: each month is derived from the dates of the
underlying match records, so past months never change unless an admin
intentionally edits a historical match. Recording a match with a past date
counts toward that past month automatically.

**Match validation** (enforced on both client and server): no player on both
teams, no empty teams, a winner is always required, a Best-of-3 must end 2–0
or 2–1 and must stop as soon as someone clinches 2 wins (1–1 and 3–0 are
rejected), Single/Bo3 are strictly 1v1, Multiplayer formats need a team of
2+, inactive players can't play, and match dates can't be in the future.

**Edit/delete safety:** match records are the single source of truth. All
statistics are recomputed from the records on every request, so editing or
deleting a match can never leave standings inconsistent.

---

## Pages

| Route | What it does |
| --- | --- |
| `/` | Dashboard — hero, league stats, monthly honours, top table, latest results |
| `/standings` | Sortable full table + win-rate and wins/losses charts |
| `/players` | Squad grid (admin: add/edit/deactivate + photo upload) |
| `/players/[id]` | Profile — career stats, monthly breakdown + trend chart, recent matches |
| `/matches` | Full history with filters (player, type, month, winner); admin edit/delete |
| `/record` | Admin match wizard: format → players/teams → result → details → confirm |
| `/awards` | Current month best/worst + permanent monthly history |
| `/settings` | Admin: league name, points rules, minimum monthly matches, awards toggle, password |
| `/login` | Admin sign-in |

Mobile-friendly throughout: the standings table collapses into cards,
navigation moves into a hamburger menu, and the record wizard works
touch-first.

## Project structure

```
lib/
  db.ts        SQLite connection, schema, auto-seed (better-sqlite3)
  stats.ts     Statistics engine — pure functions over match records
  matches.ts   Match data access + full validation (zod)
  players.ts   Player CRUD (deactivate never deletes history)
  settings.ts  League settings store
  points.ts    Pure points lookup (safe for client imports)
  auth.ts      Sessions, bcrypt passwords, admin guard
  league.ts    One-call snapshot used by pages
  view.ts      Serializable display models
  types.ts     Shared types
app/
  api/         JSON API (auth, players, matches, standings, settings, uploads)
  */page.tsx   Server components; client components in components/
scripts/
  verify.mts   Engine test suite — run it after any rule change
```

## Notes

- Uploaded photos/screenshots land in `data/uploads/` and are served through
  `/api/uploads/[file]` (works in dev and production builds).
- The three theme backgrounds live in `public/backgrounds/`: the gaming-room
  photo (dashboard hero), the trophy shot (awards + login), and the match
  texture (profile headers).
- `node:sqlite` fans: the app originally used it, but Turbopack can't bundle
  it; better-sqlite3 is the supported driver here.
