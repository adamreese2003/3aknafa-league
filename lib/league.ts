import { getAllPlayers } from "./players";
import { getAllMatches } from "./matches";
import { getSettings } from "./settings";
import {
  computePlayerStats,
  leagueTotals,
  monthlyAwards,
  monthlyHistory,
  rankForStandings,
} from "./stats";
import type { MatchRecord, Player } from "./types";

export interface LeagueSnapshot {
  players: Player[];
  playerById: Map<number, Player>;
  matches: MatchRecord[];
  settings: ReturnType<typeof getSettings>;
  standings: ReturnType<typeof rankForStandings>;
  careerStats: ReturnType<typeof computePlayerStats>;
  totals: ReturnType<typeof leagueTotals>;
}

/**
 * One call pages use to load everything they need. Cheap for a friends
 * league: the whole dataset is a few hundred rows, and recomputing stats
 * from match records on every request guarantees consistency (spec §19).
 */
export function loadLeague(): LeagueSnapshot {
  const players = getAllPlayers();
  const playerById = new Map(players.map((p) => [p.id, p]));
  const matches = getAllMatches();
  const settings = getSettings();
  const standings = rankForStandings(computePlayerStats(matches, settings), players);
  const careerStats = computePlayerStats(matches, settings);
  const totals = leagueTotals(
    matches,
    settings,
    players.filter((p) => p.active).length
  );
  return { players, playerById, matches, settings, standings, careerStats, totals };
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export { computePlayerStats, monthlyAwards, monthlyHistory, rankForStandings };
