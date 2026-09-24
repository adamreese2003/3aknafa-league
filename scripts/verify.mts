/**
 * Statistics engine verification — spec §35 scenarios plus every edge case
 * the spec calls out. Run: npx tsx scripts/verify.ts
 */
import {
  computePlayerStats,
  monthlyAwards,
  orderByPerformance,
  rankForStandings,
} from "../lib/stats";
import { validateMatchInput, ValidationError, type MatchInput } from "../lib/matches";
import { DEFAULT_SETTINGS } from "../lib/settings";
import type { MatchRecord, Player } from "../lib/types";

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`);
  }
}

const P: Player[] = [
  { id: 1, name: "Alpha", nickname: null, club: null, photoUrl: null, active: true, createdAt: "" },
  { id: 2, name: "Bravo", nickname: null, club: null, photoUrl: null, active: true, createdAt: "" },
  { id: 3, name: "Charlie", nickname: null, club: null, photoUrl: null, active: true, createdAt: "" },
  { id: 4, name: "Delta", nickname: null, club: null, photoUrl: null, active: true, createdAt: "" },
  { id: 5, name: "Echo", nickname: null, club: null, photoUrl: null, active: true, createdAt: "" },
  { id: 6, name: "Foxtrot", nickname: null, club: null, photoUrl: null, active: true, createdAt: "" },
];
const playersById = new Map(P.map((p) => [p.id, p]));
const S = DEFAULT_SETTINGS;

function mk(
  id: number,
  type: MatchRecord["type"],
  winner: "A" | "B",
  participants: [number, "A" | "B"][],
  playedAt = "2026-09-10",
  games: ("A" | "B")[] = []
): MatchRecord {
  return {
    id,
    type,
    playedAt,
    winnerSide: winner,
    games,
    location: null,
    gameTitle: null,
    notes: null,
    screenshotUrl: null,
    participants: participants.map(([playerId, side]) => ({ playerId, side })),
  };
}

console.log("\n— Spec §35: single-match scenarios —");
{
  // Alpha: 10 single wins + 5 single losses. Bravo: 5 wins 0 losses.
  const matches: MatchRecord[] = [];
  let id = 1;
  for (let i = 0; i < 10; i++) matches.push(mk(id++, "single", "A", [[1, "A"], [2, "B"]]));
  for (let i = 0; i < 5; i++) matches.push(mk(id++, "single", "B", [[1, "A"], [2, "B"]]));
  for (let i = 0; i < 5; i++) matches.push(mk(id++, "single", "A", [[3, "A"], [4, "B"]]));
  const stats = computePlayerStats(matches, S);
  const a = stats.get(1)!;
  check("Alpha played 15", a.matchesPlayed, 15);
  check("Alpha wins 10 / losses 5", [a.wins, a.losses], [10, 5]);
  check("Alpha points 10 (1 per single win)", a.points, 10);
  check("Alpha win rate 66.66…%", Math.round(a.winPct * 10) / 10, 66.7);
  const b = stats.get(3)!;
  check("Bravo 5/5/0 → 100%", [b.matchesPlayed, b.wins, b.losses, b.points], [5, 5, 0, 5]);
  check("Bravo 100% ranks above Alpha in performance order",
    orderByPerformance(stats, playersById).map((s) => s.playerId), [3, 1, 2, 4]);
}

console.log("\n— Spec §4: best-of-3 counts as ONE match —");
{
  // Charlie: 2 Bo3 wins + 1 Bo3 loss.
  const matches = [
    mk(1, "best_of_3", "A", [[1, "A"], [3, "B"]], "2026-09-01", ["A", "A"]),
    mk(2, "best_of_3", "A", [[1, "A"], [3, "B"]], "2026-09-02", ["A", "B", "A"]),
    mk(3, "best_of_3", "B", [[1, "A"], [3, "B"]], "2026-09-03", ["B", "A", "B"]),
  ];
  const c = computePlayerStats(matches, S).get(1)!;
  check("Bo3 series = 1 match played (not 3)", c.matchesPlayed, 3);
  check("2 wins / 1 loss", [c.wins, c.losses], [2, 1]);
  check("points = 2 per series win → 4 (match count ≠ point count)", c.points, 4);
  check("win rate 66.7%", Math.round(c.winPct * 10) / 10, 66.7);
}

console.log("\n— Spec §5/§6: multiplayer & multiplayer Bo3 —");
{
  const matches = [
    mk(1, "multiplayer", "A", [[1, "A"], [2, "A"], [3, "B"], [4, "B"]]),
    mk(2, "multiplayer_best_of_3", "B", [[1, "A"], [2, "A"], [3, "B"], [4, "B"], [5, "B"], [6, "B"]], "2026-09-11", ["A", "B", "B"]),
  ];
  const stats = computePlayerStats(matches, S);
  const t = (id: number) => {
    const s = stats.get(id)!;
    return [s.matchesPlayed, s.wins, s.losses, s.points];
  };
  check("2v2 winners (1,2): MP win +1 then Bo3 series loss", [t(1), t(2)], [[2, 1, 1, 1], [2, 1, 1, 1]]);
  check("3v2 Bo3 winners (3,4): series win +2 each", [t(3), t(4)], [[2, 1, 1, 2], [2, 1, 1, 2]]);
  check("P5 (only Bo3): 1 match, 1 win, +2 pts", t(5), [1, 1, 0, 2]);
  check("uneven team sizes allowed (3v2): P6 lost MP earlier, wins Bo3", t(6), [1, 1, 0, 2]);
}

console.log("\n— Spec §8/§9: monthly awards with minimum matches —");
{
  // September: Echo 0W/4 (below min 5), Charlie 4W/6, Delta 2W/10 (20%),
  // Foxtrot 8W/8 (100%). August holds one stray match to prove isolation.
  const matches: MatchRecord[] = [];
  let id = 1;
  for (let i = 0; i < 4; i++) matches.push(mk(id++, "single", "B", [[5, "A"], [3, "B"]]));
  for (let i = 0; i < 2; i++) matches.push(mk(id++, "single", "A", [[4, "A"], [3, "B"]]));
  for (let i = 0; i < 8; i++) matches.push(mk(id++, "single", "B", [[4, "A"], [6, "B"]]));
  matches.push(mk(id++, "single", "A", [[5, "A"], [1, "B"]], "2026-08-01"));

  const awards = monthlyAwards(matches, S, "2026-09", playersById);
  check("best = Foxtrot (100%, 8 matches ≥ min)", awards.best!.playerId, 6);
  check("worst = Delta (20%, qualifies) — NOT Echo (0% but only 4 matches)", awards.worst!.playerId, 4);
  check("qualifiers = 3", awards.qualifiers, 3);
  check("worst winPct 20%", Math.round(awards.worst!.winPct), 20);
  const aug = monthlyAwards(matches, S, "2026-08", playersById);
  check("August: only 2 players played, 1 match each → no award (below min)", [aug.best, aug.worst], [null, null]);
}

console.log("\n— Spec §10: tie-breakers —");
{
  // Alpha & Bravo both 75%: Alpha 6W/8mp, Bravo 3W/4mp → Alpha ahead (more wins).
  // Foxtrot sits above at 100% (3W/3); Charlie props up the losses at 0%.
  const matches: MatchRecord[] = [];
  let id = 1;
  for (let i = 0; i < 6; i++) matches.push(mk(id++, "single", "A", [[1, "A"], [3, "B"]]));
  for (let i = 0; i < 2; i++) matches.push(mk(id++, "single", "B", [[1, "A"], [6, "B"]]));
  for (let i = 0; i < 3; i++) matches.push(mk(id++, "single", "A", [[2, "A"], [3, "B"]]));
  matches.push(mk(id++, "single", "B", [[2, "A"], [6, "B"]]));
  const stats = computePlayerStats(matches, S);
  const order = orderByPerformance(stats, playersById).map((s) => s.playerId);
  check("order: Foxtrot 100% first, then equal-75% pair", order, [6, 1, 2, 3]);
  check("equal win% → more wins first (Alpha before Bravo)", order.indexOf(1) < order.indexOf(2), true);
  const standings = rankForStandings(stats, P);
  check("standings leader by win% = Foxtrot (100% despite fewer points)", standings[0].playerId, 6);
  check("equal win% → Alpha (6 wins) above Bravo (3 wins)",
    [standings[1].playerId, standings[2].playerId], [1, 2]);
}

console.log("\n— Spec §10-4: identical records are a TIE —");
{
  // Bravo & Charlie win 6 team matches together (only qualifiers — opponents
  // rotate so nobody else reaches the 5-match minimum).
  const matches: MatchRecord[] = [];
  let id = 1;
  const oppPairs = [[1, 4], [1, 5], [4, 6], [5, 6], [1, 4], [5, 6]];
  for (const [a, b] of oppPairs) {
    matches.push(mk(id++, "multiplayer", "A", [[2, "A"], [3, "A"], [a, "B"], [b, "B"]]));
  }
  const awards = monthlyAwards(matches, S, "2026-09", playersById);
  check("identical records: best still exists", awards.best !== null, true);
  check("identical records: NO worst crowned (tie beats arbitrary pick)", awards.worst, null);
  check("identical records: allTied flag set", awards.allTied, true);
  check("tie honours shared by both teammates",
    [awards.best!.playerId, ...awards.bestTiedWith].sort(), [2, 3]);

  // Bottom tie with a distinct best: Alpha 100%, Bravo & Charlie both 0%/6MP.
  const m2: MatchRecord[] = [];
  let id2 = 1;
  for (let i = 0; i < 6; i++) m2.push(mk(id2++, "single", "A", [[1, "A"], [2, "B"]]));
  for (let i = 0; i < 6; i++) m2.push(mk(id2++, "single", "A", [[1, "A"], [3, "B"]]));
  const a2 = monthlyAwards(m2, S, "2026-09", playersById);
  check("distinct best = Alpha (100%)", a2.best!.playerId, 1);
  check("worst still crowned when only the bottom ties", a2.worst !== null, true);
  check("bottom tie covers both losers",
    [...a2.worstTiedWith, a2.worst!.playerId].sort(), [2, 3]);
  check("allTied false when only the bottom ties", a2.allTied, false);
}

console.log("\n— Spec §24: zero-division & precision —");
{
  const stats = computePlayerStats([], S);
  check("no matches → empty stats", stats.size, 0);
  const one = computePlayerStats([mk(1, "single", "A", [[1, "A"], [2, "B"]])], S).get(1)!;
  check("single match 100%", Math.round(one.winPct), 100);
  const loser = computePlayerStats([mk(1, "single", "A", [[1, "A"], [2, "B"]])], S).get(2)!;
  check("single loss → 0%", Math.round(loser.winPct), 0);
}

console.log("\n— Spec §17: match validation —");
{
  const players = new Map(P.map((p) => [p.id, { active: p.active }]));
  const input = (o: Partial<MatchInput>): MatchInput => ({
    type: "single",
    playedAt: "2026-09-10",
    participants: [
      { playerId: 1, side: "A" },
      { playerId: 2, side: "B" },
    ],
    games: [],
    winnerSide: "A",
    location: null,
    gameTitle: null,
    notes: null,
    screenshotUrl: null,
    ...o,
  });
  const expectReject = (label: string, bad: MatchInput) => {
    try {
      validateMatchInput(bad, players);
      check(label, "ACCEPTED", "REJECTED");
    } catch (e) {
      check(label, e instanceof ValidationError ? "REJECTED" : `WRONG-ERROR(${e})`, "REJECTED");
    }
  };
  const expectAccept = (label: string, good: MatchInput, winner: "A" | "B") => {
    try {
      const v = validateMatchInput(good, players);
      check(label, v.winnerSide, winner);
    } catch {
      check(label, "REJECTED", winner);
    }
  };

  expectReject("player on both teams", input({ participants: [{ playerId: 1, side: "A" }, { playerId: 1, side: "B" }] }));
  expectReject("empty team B", input({ participants: [{ playerId: 1, side: "A" }] }));
  expectReject("no winner (single)", input({ winnerSide: undefined }));
  expectReject("Bo3 ending 1–1", input({ type: "best_of_3", games: ["A", "B"], winnerSide: "A" }));
  expectReject("Bo3 0–0", input({ type: "best_of_3", games: [] }));
  expectReject("Bo3 with game 4 after clinch (2–0 + extra)", input({ type: "best_of_3", games: ["A", "A", "B"] }));
  expectReject("single with 2v2 teams", input({
    participants: [
      { playerId: 1, side: "A" }, { playerId: 3, side: "A" },
      { playerId: 2, side: "B" }, { playerId: 4, side: "B" },
    ],
  }));
  expectReject("multiplayer 1v1 (should be single)", input({
    type: "multiplayer",
    participants: [{ playerId: 1, side: "A" }, { playerId: 2, side: "B" }],
  }));
  expectReject("future match date", input({ playedAt: "2999-01-01" }));
  {
    const inactiveMap = new Map(P.map((p) => [p.id, { active: p.id !== 2 }]));
    try {
      validateMatchInput(input({}), inactiveMap);
      check("inactive player rejected", "ACCEPTED", "REJECTED");
    } catch (e) {
      check("inactive player rejected", e instanceof ValidationError ? "REJECTED" : `WRONG-ERROR(${e})`, "REJECTED");
    }
  }
  expectAccept("Bo3 2–1 derives winner A", input({ type: "best_of_3", games: ["B", "A", "A"], winnerSide: "B" }), "A");
  expectAccept("Bo3 2–0 derives winner B", input({ type: "best_of_3", games: ["B", "B"] }), "B");
  expectAccept("past-month date is fine", input({ playedAt: "2026-08-15" }), "A");
}

console.log("\n— Integration: fresh seeded database (isolated temp file) —");
{
  // Point the db layer at a throwaway file so checks stay deterministic
  // no matter how many real matches the league has recorded.
  const fs = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const tmpDb = fileURLToPath(new URL("../data/.tmp-verify.db", import.meta.url));
  fs.rmSync(tmpDb, { force: true });
  fs.rmSync(`${tmpDb}-wal`, { force: true });
  fs.rmSync(`${tmpDb}-shm`, { force: true });
  process.env.LEAGUE_DB = tmpDb;

  const { getAllMatches } = await import("../lib/matches");
  const { getSettings } = await import("../lib/settings");
  const { getAllPlayers } = await import("../lib/players");

  const players = getAllPlayers();
  const settings = getSettings();
  const matches = getAllMatches();

  check("10 players seeded", players.length, 10);
  check("Benloty seeded (renamed from Unknown), photo wired",
    players.filter((p) => p.name === "Benloty" && p.photoUrl === "/players/benloty.jpeg").length, 1);
  check("no player named Unknown", players.filter((p) => p.name === "Unknown").length, 0);
  check("league name is 3AKNAFA LEAGUE", settings.leagueName, "3AKNAFA LEAGUE");
  check("points settings defaults", [settings.pointsSingle, settings.pointsBestOf3, settings.pointsMultiplayer, settings.pointsMultiplayerBo3], [1, 2, 1, 2]);
  check("no seeded matches — the league starts empty", matches.length, 0);
  check("admin user exists",
    ((await import("../lib/db")).getDb().prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n >= 1, true);

  // Best-effort cleanup — Windows keeps the file locked until the process
  // exits; the next run removes any leftovers before connecting anyway.
  for (const f of [tmpDb, `${tmpDb}-wal`, `${tmpDb}-shm`]) {
    try {
      fs.rmSync(f, { force: true });
    } catch {
      /* locked — harmless */
    }
  }
}

console.log(`\n${failed === 0 ? "✅ ALL PASS" : "❌ FAILURES"} — ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
