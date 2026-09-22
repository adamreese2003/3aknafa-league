import { z } from "zod";
import { getDb, runInTx } from "./db";
import type { MatchParticipant, MatchRecord, MatchType, Side } from "./types";

export const matchInputSchema = z.object({
  type: z.enum(["single", "best_of_3", "multiplayer", "multiplayer_best_of_3"]),
  playedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "playedAt must be YYYY-MM-DD"),
  participants: z
    .array(
      z.object({
        playerId: z.number().int().positive(),
        side: z.enum(["A", "B"]),
      })
    )
    .min(2, "A match needs at least two players"),
  games: z.array(z.enum(["A", "B"])).max(3).default([]),
  winnerSide: z.enum(["A", "B"]).optional(),
  location: z.string().trim().max(120).nullish(),
  gameTitle: z.string().trim().max(80).nullish(),
  notes: z.string().trim().max(500).nullish(),
  screenshotUrl: z.string().trim().max(300).nullish(),
});

export type MatchInput = z.infer<typeof matchInputSchema>;

export class ValidationError extends Error {}

function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Returns the side that reached 2 wins, "TOO_LONG" if games continued after
 *  the series was clinched, or null if the series is invalid/incomplete. */
function seriesWinner(games: Side[]): Side | "TOO_LONG" | null {
  let a = 0;
  let b = 0;
  for (let i = 0; i < games.length; i++) {
    if (games[i] === "A") a += 1;
    else b += 1;
    if (a === 2 || b === 2) {
      if (i < games.length - 1) return "TOO_LONG";
      return a === 2 ? "A" : "B";
    }
  }
  return null;
}

/**
 * Full match validation (spec §17). Throws ValidationError with a
 * user-presentable message; the caller maps it to HTTP 400.
 */
export function validateMatchInput(input: MatchInput, existingPlayers: Map<number, { active: boolean }>): { winnerSide: Side; games: Side[] } {
  const sideA = input.participants.filter((p) => p.side === "A");
  const sideB = input.participants.filter((p) => p.side === "B");

  if (sideA.length === 0 || sideB.length === 0) {
    throw new ValidationError("Both teams must have at least one player.");
  }

  const seen = new Set<number>();
  for (const p of input.participants) {
    if (seen.has(p.playerId)) {
      throw new ValidationError("A player cannot be on both teams (or twice on one team).");
    }
    seen.add(p.playerId);
    const known = existingPlayers.get(p.playerId);
    if (!known) throw new ValidationError(`Player #${p.playerId} does not exist.`);
    if (!known.active) throw new ValidationError("Inactive players cannot play new matches.");
  }

  if (input.playedAt > localToday()) {
    throw new ValidationError("Match date cannot be in the future.");
  }

  const isBo3 = input.type === "best_of_3" || input.type === "multiplayer_best_of_3";
  const is1v1 = sideA.length === 1 && sideB.length === 1;

  if (input.type === "single" && !is1v1) {
    throw new ValidationError("A single match must be exactly 1v1 (use Multiplayer for teams).");
  }
  if (input.type === "best_of_3" && !is1v1) {
    throw new ValidationError("A Best of 3 must be exactly 1v1 (use Multiplayer Best of 3 for teams).");
  }
  if ((input.type === "multiplayer" || input.type === "multiplayer_best_of_3") && is1v1) {
    throw new ValidationError("Multiplayer matches need at least one team with two or more players.");
  }

  if (isBo3) {
    const winner = seriesWinner(input.games);
    if (winner === null) {
      throw new ValidationError("A Best of 3 cannot end 0–0 or 1–1 — one side must reach 2 wins.");
    }
    if (winner === "TOO_LONG") {
      throw new ValidationError("A Best of 3 must stop as soon as one side reaches 2 wins.");
    }
    return { winnerSide: winner, games: input.games };
  }

  if (!input.winnerSide) {
    throw new ValidationError("A match cannot be saved without a winner.");
  }
  return { winnerSide: input.winnerSide, games: [] };
}

function rowToMatch(row: Record<string, unknown>, participants: MatchParticipant[]): MatchRecord {
  return {
    id: Number(row.id),
    type: row.type as MatchType,
    playedAt: String(row.played_at),
    winnerSide: row.winner_side as Side,
    games: JSON.parse(String(row.games ?? "[]")) as Side[],
    location: (row.location as string | null) ?? null,
    gameTitle: (row.game_title as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    screenshotUrl: (row.screenshot_url as string | null) ?? null,
    participants,
  };
}

export interface MatchFilters {
  playerId?: number;
  type?: MatchType;
  month?: string; // YYYY-MM
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  winnerId?: number;
  limit?: number;
}

export function getAllMatches(filters: MatchFilters = {}): MatchRecord[] {
  const db = getDb();
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (filters.month) {
    where.push("m.played_at LIKE ?");
    params.push(`${filters.month}-%`);
  }
  if (filters.from) {
    where.push("m.played_at >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    where.push("m.played_at <= ?");
    params.push(filters.to);
  }
  if (filters.type) {
    where.push("m.type = ?");
    params.push(filters.type);
  }
  if (filters.playerId) {
    where.push(
      `EXISTS (SELECT 1 FROM match_participants mp WHERE mp.match_id = m.id AND mp.player_id = ?)`
    );
    params.push(filters.playerId);
  }
  if (filters.winnerId) {
    where.push(
      `EXISTS (SELECT 1 FROM match_participants mw WHERE mw.match_id = m.id AND mw.player_id = ? AND mw.side = m.winner_side)`
    );
    params.push(filters.winnerId);
  }

  const sql = `
    SELECT m.* FROM matches m
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY m.played_at DESC, m.id DESC
    ${filters.limit ? "LIMIT " + filters.limit : ""}
  `;
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  if (rows.length === 0) return [];

  const participantsStmt = db.prepare(
    "SELECT player_id, side FROM match_participants WHERE match_id = ? ORDER BY side, player_id"
  );
  return rows.map((row) => {
    const parts = participantsStmt.all(Number(row.id)) as { player_id: number; side: string }[];
    return rowToMatch(
      row,
      parts.map((p) => ({ playerId: p.player_id, side: p.side as Side }))
    );
  });
}

export function getMatch(id: number): MatchRecord | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM matches WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  const parts = db
    .prepare("SELECT player_id, side FROM match_participants WHERE match_id = ? ORDER BY side, player_id")
    .all(id) as { player_id: number; side: string }[];
  return rowToMatch(
    row,
    parts.map((p) => ({ playerId: p.player_id, side: p.side as Side }))
  );
}

function loadExistingPlayers(): Map<number, { active: boolean }> {
  const db = getDb();
  const rows = db.prepare("SELECT id, active FROM players").all() as {
    id: number;
    active: number;
  }[];
  return new Map(rows.map((r) => [r.id, { active: r.active === 1 }]));
}

export function createMatch(input: MatchInput): MatchRecord {
  const db = getDb();
  const validated = validateMatchInput(input, loadExistingPlayers());
  const insertMatch = db.prepare(
    `INSERT INTO matches (type, played_at, winner_side, games, location, game_title, notes, screenshot_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertParticipant = db.prepare(
    "INSERT INTO match_participants (match_id, player_id, side) VALUES (?, ?, ?)"
  );
  let newId = 0;
  runInTx(db, () => {
    const res = insertMatch.run(
      input.type,
      input.playedAt,
      validated.winnerSide,
      JSON.stringify(validated.games),
      input.location ?? null,
      input.gameTitle ?? null,
      input.notes ?? null,
      input.screenshotUrl ?? null
    );
    newId = Number(res.lastInsertRowid);
    for (const p of input.participants) insertParticipant.run(newId, p.playerId, p.side);
  });
  return getMatch(newId)!;
}

export function updateMatch(id: number, input: MatchInput): MatchRecord | null {
  const db = getDb();
  const existing = getMatch(id);
  if (!existing) return null;
  const validated = validateMatchInput(input, loadExistingPlayers());
  const update = db.prepare(
    `UPDATE matches SET type = ?, played_at = ?, winner_side = ?, games = ?,
     location = ?, game_title = ?, notes = ?, screenshot_url = ? WHERE id = ?`
  );
  const insertParticipant = db.prepare(
    "INSERT OR REPLACE INTO match_participants (match_id, player_id, side) VALUES (?, ?, ?)"
  );
  runInTx(db, () => {
    update.run(
      input.type,
      input.playedAt,
      validated.winnerSide,
      JSON.stringify(validated.games),
      input.location ?? null,
      input.gameTitle ?? null,
      input.notes ?? null,
      input.screenshotUrl ?? null,
      id
    );
    db.prepare("DELETE FROM match_participants WHERE match_id = ?").run(id);
    for (const p of input.participants) insertParticipant.run(id, p.playerId, p.side);
  });
  return getMatch(id);
}

export function deleteMatch(id: number): boolean {
  const db = getDb();
  const res = db.prepare("DELETE FROM matches WHERE id = ?").run(id);
  return res.changes > 0;
}
