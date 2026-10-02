import StandingsTable from "@/components/StandingsTable";
import PlayerAvatar from "@/components/PlayerAvatar";
import { WinRateChart, WinsLossesChart } from "@/components/Charts";
import { loadLeague } from "@/lib/league";
import { computeStreaks } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const league = loadLeague();
  const rows = league.standings.map((s) => ({
    ...s,
    player: league.playerById.get(s.playerId)!,
  }));

  const streaks = computeStreaks(league.matches);
  const streakChips = league.players
    .filter((p) => p.active)
    .map((p) => ({ player: p, streak: streaks.get(p.id) }))
    .filter((x) => x.streak?.current)
    .sort((x, y) => {
      const a = x.streak!.current!;
      const b = y.streak!.current!;
      if (a.type !== b.type) return a.type === "W" ? -1 : 1;
      return b.count - a.count;
    })
    .slice(0, 8);

  const chartData = [...rows]
    .sort((a, b) => b.winPct - a.winPct)
    .map((r) => ({
      name: (r.player.nickname || r.player.name).split(" ")[0],
      winPct: Math.round(r.winPct * 10) / 10,
    }));

  const winsData = [...rows]
    .sort((a, b) => b.wins - a.wins)
    .map((r) => ({
      name: (r.player.nickname || r.player.name).split(" ")[0],
      wins: r.wins,
      losses: r.losses,
    }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="label">League table</p>
        <h1 className="heading-display text-3xl text-white sm:text-4xl">Standings</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          Ranked by <span className="font-semibold text-volt-300">effective win rate</span>. The
          inactivity rule: miss a full week and you lose 10 win% — another week, another 10 (raw
          rate is kept, the penalty hits the ranking only). Win % is the performance metric used
          for monthly awards too. Tap any column to sort.
        </p>
      </header>

      <StandingsTable rows={rows} />

      {streakChips.length > 0 && (
        <section className="glass mt-6 rounded-2xl p-5 sm:p-6">
          <h2 className="section-title mb-4">Current streaks</h2>
          <div className="flex flex-wrap gap-2.5">
            {streakChips.map(({ player, streak }) => {
              const cur = streak!.current!;
              const hot = cur.type === "W";
              return (
                <a
                  key={player.id}
                  href={`/players/${player.id}`}
                  className={`badge !py-1.5 ${
                    hot
                      ? "border-volt-400/50 bg-volt-400/10 text-volt-300"
                      : "border-ember-400/40 bg-ember-400/10 text-ember-400"
                  }`}
                >
                  {hot ? "🔥" : "❄️"} {player.nickname || player.name} · {cur.count}
                  {hot ? "W" : "L"}
                </a>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-12 grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5 sm:p-6">
          <h2 className="section-title mb-4">Win rate by player</h2>
          <WinRateChart data={chartData} />
        </div>
        <div className="glass rounded-2xl p-5 sm:p-6">
          <h2 className="section-title mb-4">Wins vs losses</h2>
          <WinsLossesChart data={winsData} />
        </div>
      </section>
    </div>
  );
}
