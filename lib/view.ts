import type { MatchRecord, Player, Side } from "./types";
import { MATCH_TYPE_LABELS } from "./types";
import { pointsForType } from "./points";
import type { LeagueSettings } from "./types";

export interface TeamView {
  side: Side;
  won: boolean;
  players: { id: number; name: string; photoUrl: string | null }[];
}

export interface MatchView {
  id: number;
  type: MatchRecord["type"];
  typeLabel: string;
  playedAt: string;
  score: string; // "2–1" for Bo3, "W/L" rendered by components otherwise
  winnerPoints: number;
  location: string | null;
  gameTitle: string | null;
  notes: string | null;
  screenshotUrl: string | null;
  teams: [TeamView, TeamView];
}

export function toMatchView(
  match: MatchRecord,
  playerById: Map<number, Player>,
  settings: LeagueSettings
): MatchView {
  const team = (side: Side): TeamView => ({
    side,
    won: match.winnerSide === side,
    players: match.participants
      .filter((p) => p.side === side)
      .map((p) => {
        const pl = playerById.get(p.playerId);
        return {
          id: p.playerId,
          name: pl?.nickname || pl?.name || `#${p.playerId}`,
          photoUrl: pl?.photoUrl ?? null,
        };
      }),
  });

  const aWins = match.games.filter((g) => g === "A").length;
  const bWins = match.games.length - aWins;
  const isBo3 = match.type === "best_of_3" || match.type === "multiplayer_best_of_3";
  const score = isBo3
    ? match.winnerSide === "A"
      ? `${aWins}–${bWins}`
      : `${bWins}–${aWins}`
    : "—";

  return {
    id: match.id,
    type: match.type,
    typeLabel: MATCH_TYPE_LABELS[match.type],
    playedAt: match.playedAt,
    score,
    winnerPoints: pointsForType(settings, match.type),
    location: match.location,
    gameTitle: match.gameTitle,
    notes: match.notes,
    screenshotUrl: match.screenshotUrl,
    teams: [team("A"), team("B")],
  };
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}
