/**
 * Publishes the league database to the static GitHub Pages site.
 *
 *   npx tsx scripts/export-static-data.mts
 *
 * Exports every player and match from data/league.db into docs/data/league-data.json.
 * Commit + push afterwards and the permanent site (adamreese2003.github.io/3aknafa-league)
 * shows the full league. The Google Sheet remains the fallback/remote-entry channel.
 */
import fs from "node:fs";
import path from "node:path";
import { getAllPlayers } from "../lib/players";
import { getAllMatches } from "../lib/matches";
import { getSettings } from "../lib/settings";

const players = getAllPlayers();
const matches = getAllMatches();
const settings = getSettings();

const payload = {
  exportedAt: new Date().toISOString(),
  source: "3AKNAFA LEAGUE admin app",
  settings: {
    leagueName: settings.leagueName,
    pointsSingle: settings.pointsSingle,
    pointsBestOf3: settings.pointsBestOf3,
    pointsMultiplayer: settings.pointsMultiplayer,
    pointsMultiplayerBo3: settings.pointsMultiplayerBo3,
    minMonthlyMatches: settings.minMonthlyMatches,
    monthlyAwardsEnabled: settings.monthlyAwardsEnabled,
  },
  players: players.map((p) => ({
    id: p.id,
    name: p.name,
    nickname: p.nickname,
    club: p.club,
    active: p.active,
  })),
  matches: matches
    .slice()
    .sort((a, b) => (a.playedAt === b.playedAt ? a.id - b.id : a.playedAt < b.playedAt ? -1 : 1))
    .map((m) => ({
      id: m.id,
      type: m.type,
      date: m.playedAt,
      winner: m.winnerSide,
      games: m.games,
      A: m.participants.filter((p) => p.side === "A").map((p) => p.playerId),
      B: m.participants.filter((p) => p.side === "B").map((p) => p.playerId),
      location: m.location,
      notes: m.notes,
    })),
};

const outPath = path.join(process.cwd(), "docs", "data", "league-data.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

console.log(
  `✅ exported ${matches.length} matches + ${players.length} players → docs/data/league-data.json`
);
console.log("   next: git add docs/data/league-data.json && git commit && git push");
