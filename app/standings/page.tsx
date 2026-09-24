import StandingsTable from "@/components/StandingsTable";
import { WinRateChart, WinsLossesChart } from "@/components/Charts";
import { loadLeague } from "@/lib/league";

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const league = loadLeague();
  const rows = league.standings.map((s) => ({
    ...s,
    player: league.playerById.get(s.playerId)!,
  }));

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
          Ranked by win percentage, then wins, then matches played (single win{" "}
          {league.settings.pointsSingle} pt · best-of-3 win {league.settings.pointsBestOf3} pts ·
          multiplayer win {league.settings.pointsMultiplayer} pt · multiplayer Bo3{" "}
          {league.settings.pointsMultiplayerBo3} pts still earn league points in the Pts column).
          Tap any column to sort.
        </p>
      </header>

      <StandingsTable rows={rows} />

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
