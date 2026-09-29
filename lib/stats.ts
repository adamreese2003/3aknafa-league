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
 * League standings (spec §13/§26): ranked by TOTAL WINS (rewards consistency
 * across the season), then win rate as tiebreaker, then matches played,
 * points. Players identical on every metric share a rank (tie).
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
        b.wins - a.wins ||
        b.winPct - a.winPct ||
        b.matchesPlayed - a.matchesPlayed ||
        b.points - a.points ||
        a.player!.name.localeCompare(b.player!.name)
    );

  const ranked: RankedPlayerStats[] = [];
  let lastRank = 0;
  let lastKey = "";
  sorted.forEach((s, idx) => {
    const key = `${s.wins}|${s.winPct}|${s.matchesPlayed}|${s.points}`;
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

/* ---------------- streaks ---------------- */

export interface StreakInfo {
  /** Trailing streak: "W" or "L" with its length; null when no matches. */
  current: { type: "W" | "L"; count: number } | null;
  bestWinStreak: number;
  worstLossStreak: number;
}

/** Per-player win/loss streaks over matches ordered oldest → newest. */
export function computeStreaks(matches: MatchRecord[]): Map<number, StreakInfo> {
  const chrono = [...matches].sort((a, b) =>
    a.playedAt === b.playedAt ? a.id - b.id : a.playedAt < b.playedAt ? -1 : 1
  );
  const seqs = new Map<number, ("W" | "L")[]>();
  for (const m of chrono) {
    for (const p of m.participants) {
      const seq = seqs.get(p.playerId) ?? [];
      seq.push(p.side === m.winnerSide ? "W" : "L");
      seqs.set(p.playerId, seq);
    }
  }
  const out = new Map<number, StreakInfo>();
  for (const [playerId, seq] of seqs) {
    let bestW = 0;
    let worstL = 0;
    let runType: "W" | "L" = seq[0];
    let runLen = 0;
    for (const r of seq) {
      if (r === runType) runLen++;
      else {
        if (runType === "W") bestW = Math.max(bestW, runLen);
        else worstL = Math.max(worstL, runLen);
        runType = r;
        runLen = 1;
      }
    }
    if (runType === "W") bestW = Math.max(bestW, runLen);
    else worstL = Math.max(worstL, runLen);
    const last = seq[seq.length - 1];
    let currentCount = 0;
    for (let i = seq.length - 1; i >= 0 && seq[i] === last; i--) currentCount++;
    out.set(playerId, {
      current: { type: last, count: currentCount },
      bestWinStreak: bestW,
      worstLossStreak: worstL,
    });
  }
  return out;
}

/* ---------------- head-to-head ---------------- */

export interface H2HFormatSplit {
  a: number;
  b: number;
}

export interface HeadToHead {
  aId: number;
  bId: number;
  aWins: number;
  bWins: number;
  aPoints: number;
  bPoints: number;
  /** Trailing duel streak from a's perspective. */
  currentDuel: { winnerId: number; count: number } | null;
  longestAStreak: number;
  longestBStreak: number;
  byFormat: Partial<Record<MatchType, H2HFormatSplit>>;
  /** Their meetings, newest first. */
  meetings: MatchRecord[];
}

/** All-time record between two players (matches where they faced each other). */
export function headToHead(
  matches: MatchRecord[],
  aId: number,
  bId: number,
  settings: LeagueSettings
): HeadToHead {
  const meetings = matches
    .filter((m) => {
      const aSide = m.participants.find((p) => p.playerId === aId)?.side;
      const bSide = m.participants.find((p) => p.playerId === bId)?.side;
      return aSide && bSide && aSide !== bSide;
    })
    .sort((x, y) => (x.playedAt === y.playedAt ? y.id - x.id : x.playedAt < y.playedAt ? 1 : -1));

  let aWins = 0;
  let bWins = 0;
  let aPoints = 0;
  let bPoints = 0;
  const byFormat: Partial<Record<MatchType, H2HFormatSplit>> = {};
  const results: ("A" | "B")[] = []; // from a's perspective, chronological

  // results must be chronological (oldest first) for streak math.
  for (const m of [...meetings].reverse()) {
    const aSide = m.participants.find((p) => p.playerId === aId)!.side;
    const aWon = aSide === m.winnerSide;
    const pts = pointsForType(settings, m.type);
    if (aWon) {
      aWins++;
      aPoints += pts;
      results.push("A");
    } else {
      bWins++;
      bPoints += pts;
      results.push("B");
    }
    const fmt = (byFormat[m.type] = byFormat[m.type] || { a: 0, b: 0 });
    if (aWon) fmt.a++;
    else fmt.b++;
  }

  let longestA = 0;
  let longestB = 0;
  let runType: "A" | "B" | null = null;
  let runLen = 0;
  for (const r of [...results].reverse()) {
    if (r === runType) runLen++;
    else {
      if (runType === "A") longestA = Math.max(longestA, runLen);
      if (runType === "B") longestB = Math.max(longestB, runLen);
      runType = r;
      runLen = 1;
    }
  }
  if (runType === "A") longestA = Math.max(longestA, runLen);
  if (runType === "B") longestB = Math.max(longestB, runLen);

  let currentDuel: HeadToHead["currentDuel"] = null;
  if (results.length) {
    const last = results[results.length - 1];
    let count = 0;
    for (let i = results.length - 1; i >= 0 && results[i] === last; i--) count++;
    currentDuel = { winnerId: last === "A" ? aId : bId, count };
  }

  return {
    aId,
    bId,
    aWins,
    bWins,
    aPoints,
    bPoints,
    currentDuel,
    longestAStreak: longestA,
    longestBStreak: longestB,
    byFormat,
    meetings,
  };
}
