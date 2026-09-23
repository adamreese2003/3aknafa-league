export type Side = "A" | "B";

export type MatchType = "single" | "best_of_3" | "multiplayer" | "multiplayer_best_of_3";

export interface Player {
  id: number;
  name: string;
  nickname: string | null;
  club: string | null;
  photoUrl: string | null;
  active: boolean;
  createdAt: string;
}

export interface MatchParticipant {
  playerId: number;
  side: Side;
}

/** The source of truth. All statistics are derived from these records. */
export interface MatchRecord {
  id: number;
  type: MatchType;
  playedAt: string; // YYYY-MM-DD
  winnerSide: Side;
  games: Side[]; // per-game winners for best-of-3 formats, empty otherwise
  location: string | null;
  gameTitle: string | null;
  notes: string | null;
  screenshotUrl: string | null;
  participants: MatchParticipant[];
}

export interface PlayerStats {
  playerId: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  points: number;
  /** 0–100, full precision internally */
  winPct: number;
}

export interface RankedPlayerStats extends PlayerStats {
  rank: number;
  tied: boolean;
}

export interface LeagueSettings {
  leagueName: string;
  pointsSingle: number;
  pointsBestOf3: number;
  pointsMultiplayer: number;
  pointsMultiplayerBo3: number;
  minMonthlyMatches: number;
  monthlyAwardsEnabled: boolean;
}

export interface MonthlyAward {
  playerId: number;
  winPct: number;
  wins: number;
  matchesPlayed: number;
  points: number;
}

export interface MonthlySummary {
  month: string; // YYYY-MM
  best: MonthlyAward | null;
  /** Other players whose record is identical to `best` (shared honours). */
  bestTiedWith: number[];
  worst: MonthlyAward | null;
  /** Other players whose record is identical to `worst` (shared skull). */
  worstTiedWith: number[];
  /** True when every qualifier has an identical record — no worst is crowned. */
  allTied: boolean;
  qualifiers: number;
  totalMatches: number;
}

export interface SessionUser {
  id: number;
  username: string;
  role: "admin" | "viewer";
}

export const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  single: "Single Match",
  best_of_3: "Best of 3",
  multiplayer: "Multiplayer",
  multiplayer_best_of_3: "Multiplayer Best of 3",
};
