import Link from "next/link";
import PlayerAvatar from "@/components/PlayerAvatar";
import PlayersAdmin from "@/components/PlayersAdmin";
import { getCurrentUser } from "@/lib/auth";
import { loadLeague } from "@/lib/league";
import { formatWinPct } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const league = loadLeague();
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";

  const rankById = new Map(league.standings.map((s) => [s.playerId, s.rank]));
  const cards = league.players.map((p) => {
    const s = league.careerStats.get(p.id);
    return {
      player: p,
      rank: rankById.get(p.id) ?? null,
      played: s?.matchesPlayed ?? 0,
      wins: s?.wins ?? 0,
      losses: s?.losses ?? 0,
      points: s?.points ?? 0,
      winPct: s?.winPct ?? 0,
    };
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">The squad</p>
          <h1 className="heading-display text-3xl text-white sm:text-4xl">Players</h1>
          <p className="mt-2 text-sm text-white/55">
            {league.totals.totalPlayers} active · {cards.length - league.totals.totalPlayers} inactive
          </p>
        </div>
        {isAdmin && <PlayersAdmin players={league.players} />}
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.player.id}
            href={`/players/${c.player.id}`}
            className="glass glass-hover group relative overflow-hidden rounded-2xl p-5"
          >
            <div className="absolute -right-10 -top-10 size-32 rounded-full bg-volt-400/[0.07] blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <div className="flex items-center gap-4">
              <PlayerAvatar
                name={c.player.nickname || c.player.name}
                photoUrl={c.player.photoUrl}
                size={68}
                ring={c.rank === 1}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-bold text-white group-hover:text-volt-300">
                  {c.player.nickname || c.player.name}
                </p>
                <p className="truncate text-xs text-white/45">
                  {c.player.club ?? "No club"}
                  {!c.player.active && " · inactive"}
                </p>
                {c.rank && (
                  <p className="mt-1 font-display text-xs font-bold tracking-wider text-volt-300">
                    RANK #{c.rank}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-1 border-t border-white/8 pt-4 text-center">
              {[
                { label: "MP", value: c.played, cls: "text-white/75" },
                { label: "W", value: c.wins, cls: "text-volt-300" },
                { label: "L", value: c.losses, cls: "text-ember-400/90" },
                { label: "Pts", value: c.points, cls: "text-white" },
              ].map((s) => (
                <div key={s.label}>
                  <p className={`font-display text-lg font-bold tabular-nums ${s.cls}`}>{s.value}</p>
                  <p className="text-[0.6rem] tracking-[0.16em] text-white/35">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-white/40">Win rate {formatWinPct(c.winPct)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
