import path from "node:path";
import fs from "node:fs";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";

const DATA_DIR = path.join(process.cwd(), "data");
// LEAGUE_DB lets scripts (and tests) point at a separate database file.
const DB_PATH = process.env.LEAGUE_DB
  ? path.resolve(process.env.LEAGUE_DB)
  : path.join(DATA_DIR, "league.db");

declare global {
  // eslint-disable-next-line no-var
  var __leagueDb: Database.Database | undefined;
}

export function getDb(): Database.Database {
  if (globalThis.__leagueDb) return globalThis.__leagueDb;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  autoSeed(db);
  globalThis.__leagueDb = db;
  return db;
}

/** Keep transactions explicit so schema init and seeding share one helper. */
export function runInTx(db: Database.Database, fn: () => void): void {
  db.exec("BEGIN");
  try {
    fn();
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','viewer')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      nickname TEXT,
      club TEXT,
      photo_url TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('single','best_of_3','multiplayer','multiplayer_best_of_3')),
      played_at TEXT NOT NULL,
      winner_side TEXT NOT NULL CHECK(winner_side IN ('A','B')),
      games TEXT NOT NULL DEFAULT '[]',
      location TEXT,
      game_title TEXT,
      notes TEXT,
      screenshot_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS match_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id),
      side TEXT NOT NULL CHECK(side IN ('A','B')),
      UNIQUE(match_id, player_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS league_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_matches_played_at ON matches(played_at);
    CREATE INDEX IF NOT EXISTS idx_participants_match ON match_participants(match_id);
    CREATE INDEX IF NOT EXISTS idx_participants_player ON match_participants(player_id);
  `);
}

function autoSeed(db: Database.Database): void {
  const userCount = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  if (userCount === 0) {
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')").run(
      "admin",
      bcrypt.hashSync("fifa123", 10)
    );
  }

  const playerCount = (db.prepare("SELECT COUNT(*) AS n FROM players").get() as { n: number }).n;
  if (playerCount > 0) return;

  const insertPlayer = db.prepare(
    "INSERT INTO players (name, nickname, club, photo_url, active) VALUES (?, ?, ?, ?, 1)"
  );
  const players: { name: string; nickname: string; club: string; photo: string }[] = [
    { name: "Baden Ahmed Baden", nickname: "Baden", club: "Real Madrid", photo: "/players/baden.jpeg" },
    { name: "El 3agoz", nickname: "El 3agoz", club: "Barcelona", photo: "/players/el-3agoz.jpeg" },
    { name: "El A2r3", nickname: "El A2r3", club: "Liverpool", photo: "/players/el-a2r3.jpeg" },
    { name: "El Natra", nickname: "El Natra", club: "Man City", photo: "/players/el-natra.jpeg" },
    { name: "El Tafa", nickname: "El Tafa", club: "Bayern", photo: "/players/el-tafa.jpeg" },
    { name: "Khalfy", nickname: "Khalfy", club: "PSG", photo: "/players/khalfy.jpeg" },
    { name: "Shb Zayed", nickname: "Shb Zayed", club: "Chelsea", photo: "/players/shb-zayed.jpeg" },
    { name: "Twinkies", nickname: "Twinkies", club: "Arsenal", photo: "/players/twinkies.jpeg" },
    { name: "Benloty", nickname: "Benloty", club: "Juventus", photo: "/players/benloty.jpeg" },
    { name: "Zingo", nickname: "Zingo", club: "Inter", photo: "/players/zingo.jpeg" },
  ];
  runInTx(db, () => {
    for (const p of players) {
      insertPlayer.run(p.name, p.nickname, p.club, p.photo);
    }
  });
}
