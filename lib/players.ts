import { z } from "zod";
import { getDb } from "./db";
import type { Player } from "./types";

export const playerInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  nickname: z.string().trim().max(60).nullish(),
  club: z.string().trim().max(60).nullish(),
  photoUrl: z.string().trim().max(300).nullish(),
  active: z.boolean().optional(),
});

export type PlayerInput = z.infer<typeof playerInputSchema>;

function rowToPlayer(row: Record<string, unknown>): Player {
  return {
    id: Number(row.id),
    name: String(row.name),
    nickname: (row.nickname as string | null) ?? null,
    club: (row.club as string | null) ?? null,
    photoUrl: (row.photo_url as string | null) ?? null,
    active: row.active === 1,
    createdAt: String(row.created_at),
  };
}

export function getAllPlayers(): Player[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM players ORDER BY active DESC, name COLLATE NOCASE ASC")
    .all() as Record<string, unknown>[];
  return rows.map(rowToPlayer);
}

export function getPlayerById(id: number): Player | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM players WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToPlayer(row) : null;
}

export function createPlayer(input: PlayerInput): Player {
  const db = getDb();
  const dup = db.prepare("SELECT id FROM players WHERE name = ? COLLATE NOCASE").get(input.name);
  if (dup) throw new Error("A player with this name already exists.");
  const res = db
    .prepare("INSERT INTO players (name, nickname, club, photo_url, active) VALUES (?, ?, ?, ?, ?)")
    .run(
      input.name,
      input.nickname ?? null,
      input.club ?? null,
      input.photoUrl ?? null,
      input.active === false ? 0 : 1
    );
  return getPlayerById(Number(res.lastInsertRowid))!;
}

export function updatePlayer(id: number, input: PlayerInput): Player | null {
  const db = getDb();
  const existing = getPlayerById(id);
  if (!existing) return null;
  const dup = db
    .prepare("SELECT id FROM players WHERE name = ? COLLATE NOCASE AND id != ?")
    .get(input.name, id);
  if (dup) throw new Error("A player with this name already exists.");
  db.prepare(
    "UPDATE players SET name = ?, nickname = ?, club = ?, photo_url = ?, active = ? WHERE id = ?"
  ).run(
    input.name,
    input.nickname ?? null,
    input.club ?? null,
    input.photoUrl ?? null,
    input.active === false ? 0 : 1,
    id
  );
  return getPlayerById(id);
}

/**
 * Deactivate (never hard-delete): historical statistics are preserved and the
 * player keeps appearing in past matches and monthly history.
 */
export function deactivatePlayer(id: number): Player | null {
  const db = getDb();
  db.prepare("UPDATE players SET active = 0 WHERE id = ?").run(id);
  return getPlayerById(id);
}
