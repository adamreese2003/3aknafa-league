import Image from "next/image";
import Link from "next/link";
import PlayerAvatar from "@/components/PlayerAvatar";
import { currentMonthKey, loadLeague } from "@/lib/league";
import { monthlyAwards, monthlyHistory } from "@/lib/stats";
import { formatMonth } from "@/lib/view";
import type { MonthlyAward } from "@/lib/types";

export const dynamic = "force-dynamic";

const BEST_LABEL = "🏆 EL ZABEER";
const WORST_LABEL = "💀 3AKNOFY EL SHAHR";

export default async function AwardsPage() {
  const league = loadLeague();
  const month = currentMonthKey();
  const enabled = league.settings.monthlyAwardsEnabled;

  const current = enabled
    ? monthlyAwards(league.matches, league.settings, month, league.playerById)
    : null;
  const history = enabled
    ? monthlyHistory(league.matches, league.settings, league.playerById).filter(
        (h) => h.month !== month
      )
    : [];

  const awardCard = (
    kind: "best" | "worst",
    data: MonthlyAward | null,
    tiedWith: number[],
    allTied: boolean
  ) => {
    const isBest = kind === "best";
    if (!data) {
      return (
        <div className="glass flex min-h-44 flex-col items-center justify-center rounded-3xl p-6 text-center">
          <p className="text-3xl">{isBest ? "🏆" : "💀"}</p>
          <p className="mt-2 font-display font-bold text-white/70">
            {isBest ? "EL ZABEER" : "3AKNOFY EL SHAHR"}
          </p>
          <p className="mt-1 max-w-60 text-xs text-white/40">
            {allTied
              ? "Dead tie — identical records, no skull awarded this month."
              : `Not enough qualifiers yet — a player needs ${league.settings.minMonthlyMatches} matches this month.`}
          </p>
        </div>
      );
    }
    const players = [league.playerById.get(data.playerId)!, ...tiedWith.map((id) => league.playerById.get(id)!)]
      .filter(Boolean);
    const shared = players.length > 1;
    return (
      <Link
        href={`/players/${data.playerId}`}
        className={`glass glass-hover relative overflow-hidden rounded-3xl p-6 sm:p-8 ${
          isBest ? "border-volt-400/40" : "border-ember-400/30"
        }`}
      >
        <div
          className={`absolute -right-12 -top-12 size-48 rounded-full blur-3xl ${
            isBest ? "bg-volt-400/15" : "bg-ember-500/15"
          }`}
        />
        <p
          className={`badge ${
            isBest ? "border-volt-400/50 text-volt-300" : "border-ember-400/40 text-ember-400"
          }`}
        >
          {isBest ? BEST_LABEL : WORST_LABEL}
          {shared ? " · TIE" : ""}
        </p>
        <div className="relative mt-6 flex flex-wrap items-center gap-5">
          {players.slice(0, 3).map((p) => (
            <PlayerAvatar
              key={p.id}
              name={p.name}
              photoUrl={p.photoUrl}
              size={players.length > 1 ? 72 : 96}
              ring={isBest}
            />
          ))}
          <div className="min-w-0">
            <p className="truncate font-display text-2xl font-bold text-white sm:text-3xl">
              {players.map((p) => p.nickname || p.name).join(" & ")}
            </p>
            <p
              className={`font-display text-4xl font-bold tracking-tight sm:text-5xl ${
                isBest ? "text-volt-300" : "text-ember-400"
              }`}
            >
              {data.winPct.toFixed(1)}%
            </p>
            <p className="text-sm text-white/55">
              win rate this month{shared ? " · identical records" : ""}
            </p>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-4 gap-2 border-t border-white/10 pt-5 text-center">
          {[
            { label: "Matches", value: data.matchesPlayed },
            { label: "Wins", value: data.wins },
            {
              label: "Losses",
              value: data.matchesPlayed - data.wins,
            },
            { label: "Points", value: data.points },
          ].map((s) => (
            <div key={s.label}>
              <p className="font-display text-xl font-bold tabular-nums text-white">{s.value}</p>
              <p className="text-[0.6rem] tracking-[0.16em] text-white/40">{s.label.toUpperCase()}</p>
            </div>
          ))}
        </div>
      </Link>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {/* Hero */}
      <section className="relative -mx-4 mb-10 overflow-hidden rounded-b-3xl sm:-mx-6">
        <div className="absolute inset-0">
          <Image
            src="/backgrounds/ucl-trophy.jpg"
            alt="The trophy"
            fill
            priority
            className="object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-pitch-950 via-pitch-950/75 to-pitch-950/35" />
          <div className="absolute inset-0 bg-pitch-800/40 mix-blend-multiply" />
        </div>
        <div className="relative px-4 py-14 sm:px-10 sm:py-20">
          <p className="badge mb-3 border-volt-400/40 text-volt-300">Monthly awards</p>
          <h1 className="heading-display text-3xl text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)] sm:text-5xl">
            {enabled ? formatMonth(month) : "Monthly awards are off"}
          </h1>
          <p className="mt-3 max-w-xl text-sm text-white/65">
            {enabled
              ? `Ranked by win rate among players with at least ${league.settings.minMonthlyMatches} matches this month. Ties broken by wins, then matches, then points — identical records are declared a tie.`
              : "An admin can re-enable them in Settings."}
          </p>
        </div>
      </section>

      {enabled && (
        <>
          <section className="grid gap-5 md:grid-cols-2">
            {awardCard("best", current?.best ?? null, current?.bestTiedWith ?? [], false)}
            {awardCard(
              "worst",
              current?.worst ?? null,
              current?.worstTiedWith ?? [],
              current?.allTied ?? false
            )}
          </section>

          <section className="mt-12">
            <h2 className="section-title mb-5">
              Monthly history <span className="text-white/35">· permanent record</span>
            </h2>
            {history.length === 0 ? (
              <p className="glass rounded-2xl p-6 text-sm text-white/50">
                No finished months yet — this is the first season.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {history.map((h) => {
                  const best = h.best ? league.playerById.get(h.best.playerId) : null;
                  const worst = h.worst ? league.playerById.get(h.worst.playerId) : null;
                  const bestNames = [best, ...h.bestTiedWith.map((id) => league.playerById.get(id)!)]
                    .filter(Boolean)
                    .map((p) => p!.nickname || p!.name);
                  const worstNames = [worst, ...h.worstTiedWith.map((id) => league.playerById.get(id)!)]
                    .filter(Boolean)
                    .map((p) => p!.nickname || p!.name);
                  return (
                    <div key={h.month} className="glass glass-hover rounded-2xl p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="font-display text-lg font-bold text-white">
                          {formatMonth(h.month)}
                        </h3>
                        <p className="text-xs text-white/40">
                          {h.totalMatches} matches · {h.qualifiers} qualified
                        </p>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {best && h.best && (
                          <Link
                            href={`/players/${best.id}`}
                            className="flex items-center gap-3 rounded-xl border border-volt-400/25 bg-volt-400/5 p-3 transition-colors duration-300 hover:bg-volt-400/10"
                          >
                            <span className="text-lg">🏆</span>
                            <PlayerAvatar name={best.name} photoUrl={best.photoUrl} size={38} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-white">
                                {bestNames.join(" & ")}
                                {bestNames.length > 1 && (
                                  <span className="ml-1 text-[0.65rem] font-normal text-volt-300">TIE</span>
                                )}
                              </p>
                              <p className="text-xs text-white/50">
                                {h.best.winPct.toFixed(1)}% · {h.best.wins}W / {h.best.matchesPlayed}
                              </p>
                            </div>
                          </Link>
                        )}
                        {worst && h.worst ? (
                          <Link
                            href={`/players/${worst.id}`}
                            className="flex items-center gap-3 rounded-xl border border-ember-400/25 bg-ember-400/5 p-3 transition-colors duration-300 hover:bg-ember-400/10"
                          >
                            <span className="text-lg">💀</span>
                            <PlayerAvatar name={worst.name} photoUrl={worst.photoUrl} size={38} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-white">
                                {worstNames.join(" & ")}
                                {worstNames.length > 1 && (
                                  <span className="ml-1 text-[0.65rem] font-normal text-ember-400">TIE</span>
                                )}
                              </p>
                              <p className="text-xs text-white/50">
                                {h.worst.winPct.toFixed(1)}% · {h.worst.wins}W / {h.worst.matchesPlayed}
                              </p>
                            </div>
                          </Link>
                        ) : (
                          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                            <span className="text-lg opacity-40">💀</span>
                            <p className="text-xs text-white/40">
                              {h.allTied ? "Dead tie — no 3aknofy this month" : "Not enough qualifiers"}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
