import Link from "next/link";
import Image from "next/image";
import MatchCard from "@/components/MatchCard";
import PlayerAvatar from "@/components/PlayerAvatar";
import StatCard from "@/components/StatCard";
import StandingsTable from "@/components/StandingsTable";
import { getCurrentUser } from "@/lib/auth";
import { currentMonthKey, loadLeague } from "@/lib/league";
import { monthlyAwards } from "@/lib/stats";
import { formatMonth, toMatchView } from "@/lib/view";

export default async function DashboardPage() {
  const league = loadLeague();
  const user = await getCurrentUser();
  const month = currentMonthKey();
  const awards = league.settings.monthlyAwardsEnabled
    ? monthlyAwards(league.matches, league.settings, month, league.playerById)
    : null;

  const top = league.standings
    .filter((s) => league.playerById.get(s.playerId)?.active)
    .slice(0, 5)
    .map((s) => ({ ...s, player: league.playerById.get(s.playerId)! }));

  const recent = league.matches.slice(0, 4).map((m) =>
    toMatchView(m, league.playerById, league.settings)
  );

  const bestPlayer = awards?.best ? league.playerById.get(awards.best.playerId) : null;
  const worstPlayer = awards?.worst ? league.playerById.get(awards.worst.playerId) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      {/* Hero */}
      <section className="relative -mx-4 mb-10 overflow-hidden rounded-b-3xl sm:-mx-6 sm:mb-12">
        <div className="absolute inset-0">
          <Image
            src="/backgrounds/hero-gaming.jpeg"
            alt="Friends playing FIFA"
            fill
            priority
            className="object-cover object-center opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-pitch-950 via-pitch-950/72 to-pitch-950/30" />
          <div className="absolute inset-0 bg-pitch-800/40 mix-blend-multiply" />
        </div>

        <div className="relative px-4 py-16 sm:px-10 sm:py-24 lg:py-28">
          <p className="badge mb-4 border-volt-400/40 text-volt-300">
            Season 26/27 · {formatMonth(month)}
          </p>
          <h1 className="heading-display max-w-3xl text-4xl text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)] sm:text-6xl lg:text-7xl">
            {league.settings.leagueName}
          </h1>
          <p className="mt-4 max-w-xl text-sm text-white/70 sm:text-base">
            The couch, the controllers, the bragging rights. Every match recorded,
            every point earned, every month crowned.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/standings" className="btn btn-primary">
              View standings
            </Link>
            {user?.role === "admin" ? (
              <Link href="/record" className="btn btn-ghost">
                ⚡ Record a match
              </Link>
            ) : (
              <Link href="/matches" className="btn btn-ghost">
                Match history
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* League stat cards */}
      <section className="mb-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Players"
          value={league.totals.totalPlayers}
          sub="active in the league"
        />
        <StatCard
          label="Matches played"
          value={league.totals.totalMatches}
          sub="all formats, all time"
          accent="ice"
        />
        <StatCard
          label="Highest win rate"
          value={
            league.totals.highestWinRate
              ? `${league.totals.highestWinRate.winPct.toFixed(1)}%`
              : "—"
          }
          sub={(() => {
            const s = league.totals.highestWinRate;
            if (!s) return null;
            const p = league.playerById.get(s.playerId);
            return p ? `${p.nickname || p.name} · ${s.wins}W` : null;
          })()}
          player={(() => {
            const s = league.totals.highestWinRate;
            return s ? league.playerById.get(s.playerId) ?? null : null;
          })()}
        />
        <StatCard
          label="Most wins"
          value={league.totals.mostWins?.wins ?? "—"}
          sub={(() => {
            const s = league.totals.mostWins;
            if (!s) return null;
            const p = league.playerById.get(s.playerId);
            return p ? `${p.nickname || p.name} · ${s.matchesPlayed} matches` : null;
          })()}
          accent="ice"
          player={(() => {
            const s = league.totals.mostWins;
            return s ? league.playerById.get(s.playerId) ?? null : null;
          })()}
        />
      </section>

      {/* Awards teaser */}
      {awards && (awards.best || awards.worst) && (
        <section className="mb-12">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="section-title">
              {formatMonth(month)} <span className="text-white/35">honours</span>
            </h2>
            <Link href="/awards" className="text-sm font-semibold text-volt-300 hover:text-volt-200">
              All awards →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {bestPlayer && awards.best && (
              <Link href={`/players/${bestPlayer.id}`} className="glass glass-hover group relative overflow-hidden rounded-2xl p-5">
                <div className="absolute -right-8 -top-8 size-36 rounded-full bg-volt-400/10 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
                <p className="badge border-volt-400/40 text-volt-300">🏆 Best of the month</p>
                <div className="mt-4 flex items-center gap-4">
                  <PlayerAvatar name={bestPlayer.name} photoUrl={bestPlayer.photoUrl} size={64} ring />
                  <div className="min-w-0">
                    <p className="truncate font-display text-xl font-bold text-white">
                      {bestPlayer.nickname || bestPlayer.name}
                    </p>
                    <p className="text-sm text-white/55">
                      {awards.best.winPct.toFixed(1)}% win rate · {awards.best.wins}W in {awards.best.matchesPlayed} matches
                    </p>
                  </div>
                </div>
              </Link>
            )}
            {worstPlayer && awards.worst && (
              <Link href={`/players/${worstPlayer.id}`} className="glass glass-hover group relative overflow-hidden rounded-2xl p-5">
                <div className="absolute -right-8 -top-8 size-36 rounded-full bg-ember-500/10 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
                <p className="badge border-ember-400/40 text-ember-400">💀 Worst of the month</p>
                <div className="mt-4 flex items-center gap-4">
                  <PlayerAvatar name={worstPlayer.name} photoUrl={worstPlayer.photoUrl} size={64} />
                  <div className="min-w-0">
                    <p className="truncate font-display text-xl font-bold text-white">
                      {worstPlayer.nickname || worstPlayer.name}
                    </p>
                    <p className="text-sm text-white/55">
                      {awards.worst.winPct.toFixed(1)}% win rate · {awards.worst.wins}W in {awards.worst.matchesPlayed} matches
                    </p>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Standings + recent matches */}
      <section className="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
        <div>
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="section-title">
              Top of the table <span className="text-white/35">· career</span>
            </h2>
            <Link href="/standings" className="text-sm font-semibold text-volt-300 hover:text-volt-200">
              Full table →
            </Link>
          </div>
          <StandingsTable rows={top} />
        </div>
        <div>
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 className="section-title">
              Latest results
            </h2>
            <Link href="/matches" className="text-sm font-semibold text-volt-300 hover:text-volt-200">
              History →
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {recent.length === 0 && (
              <p className="glass rounded-2xl p-6 text-sm text-white/50">
                No matches yet — the season is waiting for kick-off.
              </p>
            )}
            {recent.map((m) => (
              <MatchCard key={m.id} match={m} compact />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
