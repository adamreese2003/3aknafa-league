import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import PlayerAvatar from "@/components/PlayerAvatar";
import { MonthlyTrendChart } from "@/components/Charts";
import { loadLeague } from "@/lib/league";
import { computePlayerStats, monthKeyOf } from "@/lib/stats";
import { getSettings, pointsForType } from "@/lib/settings";
import { formatDate, formatMonth } from "@/lib/view";
import { getAllPlayers } from "@/lib/players";
import { getAllMatches } from "@/lib/matches";
import { MATCH_TYPE_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playerId = Number(id);
  const players = getAllPlayers();
  const player = players.find((p) => p.id === playerId);
  if (!player) notFound();

  const matches = getAllMatches({ playerId });
  const settings = getSettings();
  const allMatches = getAllMatches();
  const career = computePlayerStats(allMatches, settings).get(playerId) ?? {
    playerId,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    points: 0,
    winPct: 0,
  };

  // Standings rank among all players
  const league = loadLeague();
  const rank = league.standings.find((s) => s.playerId === playerId)?.rank ?? null;
  const playerById = league.playerById;

  // Monthly breakdown
  const byMonth = new Map<string, { played: number; wins: number }>();
  for (const m of matches) {
    const key = monthKeyOf(m.playedAt);
    const cur = byMonth.get(key) ?? { played: 0, wins: 0 };
    cur.played += 1;
    const me = m.participants.find((p) => p.playerId === playerId);
    if (me && me.side === m.winnerSide) cur.wins += 1;
    byMonth.set(key, cur);
  }
  const monthlyRows = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const trend = [...monthlyRows].reverse().map(([month, v]) => ({
    month: month.slice(5) + "/" + month.slice(2, 4),
    winPct: Math.round((v.wins / v.played) * 1000) / 10,
    matches: v.played,
  }));

  // Recent matches from this player's perspective
  // Format breakdown — how much of this record was built in team play
  const fmt = new Map<string, { played: number; wins: number }>();
  for (const m of matches) {
    const cur = fmt.get(m.type) ?? { played: 0, wins: 0 };
    cur.played += 1;
    const me = m.participants.find((p) => p.playerId === playerId);
    if (me && me.side === m.winnerSide) cur.wins += 1;
    fmt.set(m.type, cur);
  }
  const sumTypes = (types: string[]) =>
    types.reduce(
      (acc, t) => {
        const v = fmt.get(t);
        return { played: acc.played + (v?.played ?? 0), wins: acc.wins + (v?.wins ?? 0) };
      },
      { played: 0, wins: 0 }
    );
  const solo = sumTypes(["single", "best_of_3"]);
  const team = sumTypes(["multiplayer", "multiplayer_best_of_3"]);
  const pctOf = (v: { played: number; wins: number }) =>
    v.played > 0 ? (v.wins / v.played) * 100 : 0;
  const enoughSamples = team.played >= 3 && solo.played >= 3;
  const carried = enoughSamples && pctOf(team) - pctOf(solo) >= 25;
  const loneWolf = enoughSamples && pctOf(solo) - pctOf(team) >= 25;

  const recent = matches.slice(0, 10).map((m) => {
    const me = m.participants.find((p) => p.playerId === playerId)!;
    const won = me.side === m.winnerSide;
    const opponents = m.participants
      .filter((p) => p.side !== me.side)
      .map((p) => playerById.get(p.playerId)?.nickname || playerById.get(p.playerId)?.name || "?")
      .join(" & ");
    const isBo3 = m.type === "best_of_3" || m.type === "multiplayer_best_of_3";
    const aWins = m.games.filter((g) => g === "A").length;
    const bWins = m.games.length - aWins;
    return {
      id: m.id,
      date: m.playedAt,
      won,
      opponents,
      isBo3,
      score: isBo3
        ? me.side === "A"
          ? `${aWins}–${bWins}`
          : `${bWins}–${aWins}`
        : null,
      typeLabel:
        m.type === "single"
          ? "1v1"
          : m.type === "best_of_3"
            ? "Bo3"
            : m.type === "multiplayer"
              ? "MP"
              : "MP Bo3",
      earned: won ? pointsForType(settings, m.type) : 0,
    };
  });

  const displayName = player.nickname || player.name;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/players" className="text-sm font-semibold text-white/50 transition-colors hover:text-volt-300">
        ← All players
      </Link>

      {/* Header */}
      <header className="relative mt-4 overflow-hidden rounded-3xl">
        <div className="absolute inset-0">
          <Image
            src="/backgrounds/matches-bg.avif"
            alt=""
            fill
            className="object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-pitch-950 via-pitch-950/85 to-pitch-950/40" />
          <div className="absolute inset-0 bg-pitch-800/30 mix-blend-multiply" />
        </div>
        <div className="relative flex flex-wrap items-center gap-6 p-6 sm:p-10">
          {player.photoUrl ? (
            <Image
              src={player.photoUrl}
              alt={displayName}
              width={140}
              height={140}
              className="size-24 rounded-3xl object-cover shadow-float ring-2 ring-volt-400/70 sm:size-32"
            />
          ) : (
            <span className="grid size-24 place-items-center rounded-3xl bg-pitch-700 font-display text-4xl font-bold text-white/60 sm:size-32">
              {displayName[0]?.toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            {rank && (
              <p className="badge mb-2 border-volt-400/40 text-volt-300">
                {rank === 1 ? "👑 " : ""}Rank #{rank} of {league.standings.length}
              </p>
            )}
            <h1 className="heading-display text-3xl text-white sm:text-5xl">{displayName}</h1>
            <p className="mt-1.5 text-sm text-white/55">
              {player.name}
              {player.club && ` · ${player.club}`}
              {!player.active && " · inactive"}
            </p>
          </div>
        </div>
      </header>

      {/* Stat tiles */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Win rate", value: `${career.winPct.toFixed(1)}%`, cls: "text-volt-300" },
          { label: "Matches", value: career.matchesPlayed, cls: "text-white" },
          { label: "Wins", value: career.wins, cls: "text-volt-300" },
          { label: "Losses", value: career.losses, cls: "text-ember-400" },
          { label: "Points", value: career.points, cls: "text-white" },
          {
            label: "Points / match",
            value: career.matchesPlayed
              ? (career.points / career.matchesPlayed).toFixed(2)
              : "0.00",
            cls: "text-ice-300",
          },
        ].map((s) => (
          <div key={s.label} className="glass glass-hover rounded-2xl p-4 text-center sm:p-5">
            <p className={`font-display text-2xl font-bold tabular-nums sm:text-3xl ${s.cls}`}>
              {s.value}
            </p>
            <p className="mt-1 text-[0.65rem] tracking-[0.16em] text-white/40">
              {s.label.toUpperCase()}
            </p>
          </div>
        ))}
      </section>

      {/* Format breakdown — solo vs team */}
      <section className="glass mt-6 rounded-2xl p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title">Solo vs team matches</h2>
          <div className="flex flex-wrap gap-2">
            <span className="badge border-white/15 text-white/60">
              SOLO: {solo.played} MP · {pctOf(solo).toFixed(1)}%
            </span>
            <span className="badge border-ice-400/40 text-ice-300">
              TEAMS: {team.played} MP · {pctOf(team).toFixed(1)}%
            </span>
          </div>
        </div>

        {carried && (
          <p className="mb-4 rounded-xl border border-ember-400/30 bg-ember-400/10 px-4 py-2.5 text-sm text-ember-400">
            🚗 Carried alert — wins almost exclusively in team matches. Somebody’s riding a mate.
          </p>
        )}
        {loneWolf && (
          <p className="mb-4 rounded-xl border border-ice-400/30 bg-ice-400/10 px-4 py-2.5 text-sm text-ice-300">
            🐺 Lone wolf — clearly better without a teammate.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              { key: "single", label: MATCH_TYPE_LABELS.single, team: false },
              { key: "best_of_3", label: MATCH_TYPE_LABELS.best_of_3, team: false },
              { key: "multiplayer", label: MATCH_TYPE_LABELS.multiplayer, team: true },
              { key: "multiplayer_best_of_3", label: MATCH_TYPE_LABELS.multiplayer_best_of_3, team: true },
            ] as const
          ).map(({ key, label, team: isTeamFmt }) => {
            const v = fmt.get(key) ?? { played: 0, wins: 0 };
            const pct = pctOf(v);
            return (
              <div
                key={key}
                className={`rounded-xl border p-4 ${
                  isTeamFmt ? "border-ice-400/25 bg-ice-400/[0.06]" : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <p className="text-[0.65rem] font-bold tracking-[0.14em] text-white/40">
                  {label.toUpperCase()}
                </p>
                <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-white">
                  {v.played}
                  <span className="ml-1 text-xs font-semibold text-white/40">MP</span>
                </p>
                <p className="text-xs text-white/55">
                  {v.wins}W · {v.played - v.wins}L ·{" "}
                  <span className="tabular-nums">{pct.toFixed(1)}%</span>
                </p>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/10">
                  <span
                    className={`block h-full rounded-full ${
                      isTeamFmt
                        ? "bg-gradient-to-r from-ice-500 to-ice-300"
                        : "bg-gradient-to-r from-volt-500 to-volt-300"
                    }`}
                    style={{ width: `${Math.round(pct)}%` }}
                  />
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        {/* Monthly performance */}
        <section className="glass rounded-2xl p-5 sm:p-6">
          <h2 className="section-title mb-4">Monthly performance</h2>
          {monthlyRows.length === 0 ? (
            <p className="text-sm text-white/50">No matches recorded yet.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="pb-2.5 text-left font-display text-[0.68rem] tracking-[0.14em] text-white/45">MONTH</th>
                    <th className="pb-2.5 text-right font-display text-[0.68rem] tracking-[0.14em] text-white/45">MP</th>
                    <th className="pb-2.5 text-right font-display text-[0.68rem] tracking-[0.14em] text-white/45">W</th>
                    <th className="pb-2.5 text-right font-display text-[0.68rem] tracking-[0.14em] text-white/45">WIN %</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.map(([month, v]) => {
                    const pct = (v.wins / v.played) * 100;
                    return (
                      <tr key={month} className="border-b border-white/5 last:border-0">
                        <td className="py-2.5 font-medium text-white/85">{formatMonth(month)}</td>
                        <td className="py-2.5 text-right tabular-nums text-white/60">{v.played}</td>
                        <td className="py-2.5 text-right tabular-nums text-volt-300">{v.wins}</td>
                        <td className="py-2.5 text-right">
                          <span className="inline-flex items-center gap-2">
                            <span className="tabular-nums text-white/80">{pct.toFixed(1)}%</span>
                            <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-white/10 sm:inline-block">
                              <span
                                className="block h-full rounded-full bg-gradient-to-r from-volt-500 to-volt-300"
                                style={{ width: `${Math.round(pct)}%` }}
                              />
                            </span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {trend.length > 1 && (
                <div className="mt-5 border-t border-white/8 pt-4">
                  <p className="label">Trend</p>
                  <MonthlyTrendChart data={trend} />
                </div>
              )}
            </>
          )}
        </section>

        {/* Recent matches */}
        <section className="glass rounded-2xl p-5 sm:p-6">
          <h2 className="section-title mb-4">Recent matches</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-white/50">No matches recorded yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-white/5">
              {recent.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-3">
                  <span
                    className={`badge w-14 justify-center ${
                      m.won
                        ? "border-volt-400/40 bg-volt-400/10 text-volt-300"
                        : "border-ember-400/40 bg-ember-400/10 text-ember-400"
                    }`}
                  >
                    {m.won ? "WIN" : "LOSS"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white/90">
                      vs {m.opponents}
                      <span className="ml-2 text-xs font-normal text-white/40">{m.typeLabel}</span>
                    </p>
                    <p className="text-xs text-white/40">{formatDate(m.date)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {m.score && (
                      <p className="font-display text-base font-bold tabular-nums text-white">
                        {m.score}
                      </p>
                    )}
                    <p className={`text-xs tabular-nums ${m.earned > 0 ? "text-volt-300" : "text-white/30"}`}>
                      +{m.earned} pt
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
