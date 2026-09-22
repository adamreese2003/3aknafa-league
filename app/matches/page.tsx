import MatchesBrowser from "@/components/MatchesBrowser";
import { getCurrentUser } from "@/lib/auth";
import { loadLeague } from "@/lib/league";
import { toMatchView } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const league = loadLeague();
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";

  const matches = league.matches
    .map((m) => toMatchView(m, league.playerById, league.settings))
    .reverse(); // oldest first for chronological reading; browser re-filters

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="label">Every game counts</p>
        <h1 className="heading-display text-3xl text-white sm:text-4xl">Match history</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          Full record of every match and series. Filter by player, format, month or winner.
        </p>
      </header>
      <MatchesBrowser matches={matches} players={league.players} isAdmin={isAdmin} />
    </div>
  );
}
