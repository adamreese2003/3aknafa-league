import Link from "next/link";
import PlayerAvatar from "./PlayerAvatar";
import type { MatchView } from "@/lib/view";
import { formatDate } from "@/lib/view";

const TYPE_BADGE: Record<string, string> = {
  single: "border-white/15 text-white/60",
  best_of_3: "border-ice-400/40 text-ice-300",
  multiplayer: "border-white/15 text-white/60",
  multiplayer_best_of_3: "border-ice-400/40 text-ice-300",
};

function TeamSide({
  team,
  size,
  linked = true,
}: {
  team: MatchView["teams"][number];
  size: number;
  linked?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col gap-1.5 ${
        team.side === "B" ? "items-end text-right" : "items-start"
      }`}
    >
      {team.players.map((p) => {
        const avatar = <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size={size} ring={team.won} />;
        return (
          <div key={p.id} className="flex min-w-0 items-center gap-2">
            {team.side === "B" && linked ? (
              <Link href={`/players/${p.id}`} className="truncate">
                <span
                  className={`block truncate text-sm font-semibold ${
                    team.won ? "text-white" : "text-white/55"
                  }`}
                >
                  {p.name}
                </span>
              </Link>
            ) : null}
            {linked ? (
              <Link href={`/players/${p.id}`} className="shrink-0">
                {avatar}
              </Link>
            ) : (
              avatar
            )}
            {team.side === "A" && linked ? (
              <Link href={`/players/${p.id}`} className="truncate">
                <span
                  className={`block truncate text-sm font-semibold ${
                    team.won ? "text-white" : "text-white/55"
                  }`}
                >
                  {p.name}
                </span>
              </Link>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function MatchCard({ match, compact = false }: { match: MatchView; compact?: boolean }) {
  return (
    <article className="glass glass-hover rounded-2xl p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`badge ${TYPE_BADGE[match.type]}`}>{match.typeLabel}</span>
        <span className="text-xs text-white/40">{formatDate(match.playedAt)}</span>
        {match.winnerPoints > 0 && (
          <span className="badge border-volt-400/40 text-volt-300">+{match.winnerPoints} pts</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <TeamSide team={match.teams[0]} size={compact ? 34 : 42} />

        <div className="flex shrink-0 flex-col items-center">
          <span
            className={`font-display text-xl font-bold tracking-tight sm:text-2xl ${
              match.score === "—" ? "text-white/30" : "text-white"
            }`}
          >
            {match.score}
          </span>
          <span className="mt-0.5 text-[0.62rem] font-bold tracking-[0.18em] text-white/35">
            {match.score === "—" ? "VS" : "SERIES"}
          </span>
        </div>

        <TeamSide team={match.teams[1]} size={compact ? 34 : 42} />
      </div>

      {match.notes && !compact && (
        <p className="mt-3 border-t border-white/5 pt-2.5 text-xs italic text-white/40">
          “{match.notes}”
        </p>
      )}
    </article>
  );
}
