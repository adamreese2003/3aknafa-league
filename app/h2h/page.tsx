import Link from "next/link";
import PlayerAvatar from "@/components/PlayerAvatar";
import MatchCard from "@/components/MatchCard";
import H2HPicker from "@/components/H2HPicker";
import { loadLeague } from "@/lib/league";
import { headToHead } from "@/lib/stats";
import { MATCH_TYPE_LABELS } from "@/lib/types";
import { toMatchView } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function H2HPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;
  const league = loadLeague();
  const active = league.players.filter((p) => p.active);
  const aId = Number(a) || null;
  const bId = Number(b) || null;
  const pa = aId ? league.playerById.get(aId) : null;
  const pb = bId ? league.playerById.get(bId) : null;

  const both = pa && pb && pa.id !== pb.id;
  const h2h = both ? headToHead(league.matches, pa!.id, pb!.id, league.settings) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="label">Settle it on the screen</p>
        <h1 className="heading-display text-3xl text-white sm:text-4xl">Head-to-head</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          All-time records between any two players — every meeting, every format, streaks included.
        </p>
      </header>

      <H2HPicker players={active} aId={pa?.id ?? null} bId={pb?.id ?? null} />

      {!both && (
        <p className="glass mt-6 rounded-2xl p-6 text-sm text-white/50">
          Pick two players above to see their rivalry record.
        </p>
      )}

      {h2h && pa && pb && (
        <>
          <section className="glass mt-8 rounded-3xl p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <Link href={`/players/${pa.id}`} className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
                <PlayerAvatar name={pa.nickname || pa.name} photoUrl={pa.photoUrl} size={72} />
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-bold text-white sm:text-xl">
                    {pa.nickname || pa.name}
                  </p>
                  <p className="font-display text-4xl font-bold tracking-tight text-volt-300 sm:text-5xl">
                    {h2h.aWins}
                  </p>
                  <p className="text-xs text-white/40">wins</p>
                </div>
              </Link>

              <div className="shrink-0 text-center">
                <p className="font-display text-2xl font-bold text-white/25 sm:text-3xl">VS</p>
                <p className="mt-1 text-xs text-white/40">
                  {h2h.meetings.length} meeting{h2h.meetings.length === 1 ? "" : "s"}
                </p>
              </div>

              <Link href={`/players/${pb.id}`} className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center sm:flex-row-reverse sm:text-right">
                <PlayerAvatar name={pb.nickname || pb.name} photoUrl={pb.photoUrl} size={72} />
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-bold text-white sm:text-xl">
                    {pb.nickname || pb.name}
                  </p>
                  <p className="font-display text-4xl font-bold tracking-tight text-ice-300 sm:text-5xl">
                    {h2h.bWins}
                  </p>
                  <p className="text-xs text-white/40">wins</p>
                </div>
              </Link>
            </div>

            {h2h.currentDuel && (
              <p className="mt-6 border-t border-white/10 pt-4 text-center text-sm text-white/70">
                {h2h.currentDuel.winnerId === pa.id ? (
                  <>🔥 {(league.playerById.get(h2h.currentDuel.winnerId)?.nickname) || pa.name} won the last {h2h.currentDuel.count >= 2 ? `${h2h.currentDuel.count} meetings` : "meeting"} in a row</>
                ) : (
                  <>🔥 {(league.playerById.get(h2h.currentDuel.winnerId)?.nickname) || pb.name} won the last {h2h.currentDuel.count >= 2 ? `${h2h.currentDuel.count} meetings` : "meeting"} in a row</>
                )}
                <span className="ml-3 text-white/40">
                  longest runs: {pa.nickname || pa.name} {h2h.longestAStreak}W · {pb.nickname || pb.name} {h2h.longestBStreak}W
                </span>
              </p>
            )}
          </section>

          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(Object.keys(MATCH_TYPE_LABELS) as (keyof typeof MATCH_TYPE_LABELS)[]).map((type) => {
              const split = h2h.byFormat[type];
              return (
                <div key={type} className="glass glass-hover rounded-2xl p-4 text-center">
                  <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-white/40">
                    {MATCH_TYPE_LABELS[type]}
                  </p>
                  <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-white">
                    {split ? `${split.a}–${split.b}` : "–"}
                  </p>
                  <p className="text-[0.65rem] text-white/35">
                    {split ? `${pa.nickname || pa.name} first` : "never played"}
                  </p>
                </div>
              );
            })}
          </section>

          <section className="mt-10">
            <h2 className="section-title mb-4">
              Their meetings <span className="text-white/35">· newest first</span>
            </h2>
            {h2h.meetings.length === 0 ? (
              <p className="glass rounded-2xl p-6 text-sm text-white/50">
                They have never faced each other — a rivalry waiting to happen.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {h2h.meetings.map((m) => (
                  <MatchCard key={m.id} match={toMatchView(m, league.playerById, league.settings)} compact />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
