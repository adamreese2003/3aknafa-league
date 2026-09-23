import type {
  LeagueSettings,
  MatchRecord,
  MatchType,
  MonthlyAward,
  MonthlySummary,
  Player,
  PlayerStats,
  RankedPlayerStats,
} from "./types";
import { pointsForType } from "./points";

/**
 * Statistics engine — pure functions over match records.
 * Match records are the single source of truth; every number below is derived,
 * so editing/deleting a match can never leave statistics inconsistent.
 */
export function computePlayerStats(
  matches: MatchRecord[],
  settings: LeagueSettings
): Map<number, PlayerStats> {
  const stats = new Map<number, PlayerStats>();
  const get = (playerId: number): PlayerStats => {
    let s = stats.get(playerId);
    if (!s) {
      s = { playerId, matchesPlayed: 0, wins: 0, losses: 0, points: 0, winPct: 0 };
      stats.set(playerId, s);
    }
    return s;
  };

  for (const match of matches) {
    const winnerPoints = pointsForType(settings, match.type);
    for (const p of match.participants) {
      const s = get(p.playerId);
      s.matchesPlayed += 1;
      if (p.side === match.winnerSide) {
        s.wins += 1;
        s.points += winnerPoints;
      } else {
        s.losses += 1;
      }
    }
  }
  for (const s of stats.values()) {
    s.winPct = s.matchesPlayed > 0 ? (s.wins / s.matchesPlayed) * 100 : 0;
  }
  return stats;
}

export function mergeStats(...all: Map<number, PlayerStats>[]): Map<number, PlayerStats> {
  const out = new Map<number, PlayerStats>();
  for (const map of all) {
    for (const s of map.values()) {
      const cur = out.get(s.playerId) ?? {
        playerId: s.playerId,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        points: 0,
        winPct: 0,
      };
      cur.matchesPlayed += s.matchesPlayed;
      cur.wins += s.wins;
      cur.losses += s.losses;
      cur.points += s.points;
      out.set(s.playerId, cur);
    }
  }
  for (const s of out.values()) {
    s.winPct = s.matchesPlayed > 0 ? (s.wins / s.matchesPlayed) * 100 : 0;
  }
  return out;
}

/**
 * Performance ordering used for monthly awards (spec §8–10):
 * win percentage first, then wins, matches played, points. Deterministic —
 * a stable name ordering guarantees identical players stay adjacent.
 */
export function orderByPerformance(
  stats: Map<number, PlayerStats>,
  players: Map<number, Player>
): PlayerStats[] {
  const nameOf = (id: number) => players.get(id)?.name ?? `#${id}`;
  return [...stats.values()].sort(
    (a, b) =>
      b.winPct - a.winPct ||
      b.wins - a.wins ||
      b.matchesPlayed - a.matchesPlayed ||
      b.points - a.points ||
      nameOf(a.playerId).localeCompare(nameOf(b.playerId))
  );
}

/**
 * League standings (spec §13/§26): ranked by league points, then win rate,
 * wins, matches played. Players identical on every metric share a rank (tie).
 */
export function rankForStandings(
  stats: Map<number, PlayerStats>,
  players: Player[]
): RankedPlayerStats[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const sorted = [...stats.values()]
    .map((s) => ({ ...s, player: byId.get(s.playerId) }))
    .filter((s) => s.player !== undefined)
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.winPct - a.winPct ||
        b.wins - a.wins ||
        b.matchesPlayed - a.matchesPlayed ||
        a.player!.name.localeCompare(b.player!.name)
    );

  const ranked: RankedPlayerStats[] = [];
  let lastRank = 0;
  let lastKey = "";
  sorted.forEach((s, idx) => {
    const key = `${s.points}|${s.winPct}|${s.wins}|${s.matchesPlayed}`;
    const tied = key === lastKey;
    const rank = tied ? lastRank : idx + 1;
    lastRank = rank;
    lastKey = key;
    const { player, ...rest } = s;
    ranked.push({ ...rest, rank, tied });
  });
  return ranked;
}

export function monthKeyOf(playedAt: string): string {
  return playedAt.slice(0, 7); // YYYY-MM
}

export function matchesInMonth(matches: MatchRecord[], month: string): MatchRecord[] {
  return matches.filter((m) => monthKeyOf(m.playedAt) === month);
}

/**
 * Monthly awards (spec §8–10): only players meeting the minimum-matches
 * threshold qualify. Best = top of the performance order; worst = bottom of
 * that same order (lowest win %, and among equal rates the fewer wins).
 * Fully identical records are a TIE (spec §10 tie-breaker 4): the best is
 * shared and no worst player is crowned, rather than picking arbitrarily.
 */
export function monthlyAwards(
  matches: MatchRecord[],
  settings: LeagueSettings,
  month: string,
  players: Map<number, Player>
): MonthlySummary {
  const monthly = matchesInMonth(matches, month);
  const stats = computePlayerStats(monthly, settings);
  const eligible = [...stats.values()].filter(
    (s) => s.matchesPlayed >= settings.minMonthlyMatches
  );
  const ordered = orderByPerformance(
    new Map(eligible.map((s) => [s.playerId, s])),
    players
  );

  const toAward = (s: PlayerStats | null | undefined): MonthlyAward | null =>
    s ? { playerId: s.playerId, winPct: s.winPct, wins: s.wins, matchesPlayed: s.matchesPlayed, points: s.points } : null;

  const recordKey = (s: PlayerStats) => `${s.winPct}|${s.wins}|${s.matchesPlayed}|${s.points}`;
  const best = ordered[0];
  const last = ordered.length >= 2 ? ordered[ordered.length - 1] : null;
  const allTied = !!best && !!last && recordKey(last) === recordKey(best);

  return {
    month,
    best: toAward(best),
    bestTiedWith: best
      ? ordered
          .slice(1)
          .filter((s) => recordKey(s) === recordKey(best))
          .map((s) => s.playerId)
      : [],
    worst: allTied || !last ? null : toAward(last),
    worstTiedWith:
      !allTied && last
        ? ordered
            .slice(0, -1)
            .filter((s) => recordKey(s) === recordKey(last))
            .map((s) => s.playerId)
        : [],
    allTied,
    qualifiers: eligible.length,
    totalMatches: monthly.length,
  };
}

/** Every month that has at least one match, newest first. */
export function monthlyHistory(
  matches: MatchRecord[],
  settings: LeagueSettings,
  players: Map<number, Player>
): MonthlySummary[] {
  const months = [...new Set(matches.map((m) => monthKeyOf(m.playedAt)))].sort().reverse();
  return months.map((month) => monthlyAwards(matches, settings, month, players));
}

export interface LeagueTotals {
  totalPlayers: number;
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  totalPoints: number;
  highestWinRate: PlayerStats | null;
  mostWins: PlayerStats | null;
  mostMatches: PlayerStats | null;
}

export function leagueTotals(
  matches: MatchRecord[],
  settings: LeagueSettings,
  activePlayerCount: number
): LeagueTotals {
  const stats = [...computePlayerStats(matches, settings).values()];
  const best = (fn: (a: PlayerStats, b: PlayerStats) => number) =>
    [...stats].sort(fn)[0] ?? null;
  return {
    totalPlayers: activePlayerCount,
    totalMatches: matches.length,
    totalWins: stats.reduce((n, s) => n + s.wins, 0),
    totalLosses: stats.reduce((n, s) => n + s.losses, 0),
    totalPoints: stats.reduce((n, s) => n + s.points, 0),
    highestWinRate: stats.length
      ? best((a, b) => b.winPct - a.winPct || b.matchesPlayed - a.matchesPlayed)
      : null,
    mostWins: stats.length ? best((a, b) => b.wins - a.wins) : null,
    mostMatches: stats.length ? best((a, b) => b.matchesPlayed - a.matchesPlayed) : null,
  };
}

/** Display helper: one decimal place, e.g. 66.7% (spec §24). */
export function formatWinPct(winPct: number): string {
  return `${winPct.toFixed(1)}%`;
}

export function matchPointsLabel(type: MatchType, settings: LeagueSettings): number {
  return pointsForType(settings, type);
}
