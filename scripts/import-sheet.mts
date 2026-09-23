/**
 * Imports matches from the friends' filled match-log workbook into the league.
 *
 *   npx tsx scripts/import-sheet.mts [path-to-xlsx]           → preview (dry run)
 *   npx tsx scripts/import-sheet.mts [path-to-xlsx] --apply   → actually record
 *
 * Defaults to 3AKNAFA-match-log.xlsx in the project folder. Rows whose
 * "In app?" cell is filled are skipped, as are the EXAMPLE rows.
 */
import ExcelJS from "exceljs";
import path from "node:path";
import fs from "node:fs";
import { getAllPlayers } from "../lib/players";
import { validateMatchInput, ValidationError, type MatchInput } from "../lib/matches";

const file = process.argv.find((a) => a.endsWith(".xlsx")) ?? "3AKNAFA-match-log.xlsx";
const apply = process.argv.includes("--apply");
const apiUrl = process.env.LEAGUE_URL ?? "http://localhost:3000";
const adminUser = process.env.LEAGUE_ADMIN_USER ?? "admin";
const adminPass = process.env.LEAGUE_ADMIN_PASSWORD ?? "fifa123";

const TYPE_MAP: Record<string, MatchInput["type"]> = {
  single: "single",
  "best of 3": "best_of_3",
  multiplayer: "multiplayer",
  "multiplayer bo3": "multiplayer_best_of_3",
};

if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

const players = getAllPlayers();
const nameToId = new Map<string, number>();
for (const p of players) {
  nameToId.set(p.name.toLowerCase(), p.id);
  if (p.nickname) nameToId.set(p.nickname.toLowerCase(), p.id);
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const log = wb.getWorksheet("Match Log");
if (!log) {
  console.error('No "Match Log" tab in this workbook.');
  process.exit(1);
}

const iso = (v: ExcelJS.CellValue): string | null => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v.trim())) return v.trim().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date (days since 1899-12-30)
    return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  }
  return null;
};

const parseTeam = (raw: string): number[] => {
  const ids: number[] = [];
  for (const name of raw.split("+").map((s) => s.trim()).filter(Boolean)) {
    const id = nameToId.get(name.toLowerCase());
    if (id === undefined) throw new ValidationError(`Unknown player "${name}" — use the exact name from the Players tab`);
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
};

const parsed: { row: number; input: MatchInput }[] = [];
const errors: { row: number; error: string }[] = [];
let skipped = 0;

log.eachRow((row, rowNumber) => {
  if (rowNumber === 1) return; // header
  const date = iso(row.getCell(1).value);
  const type = String(row.getCell(2).value ?? "").trim().toLowerCase();
  const teamA = String(row.getCell(3).value ?? "").trim();
  const teamB = String(row.getCell(4).value ?? "").trim();
  const winner = String(row.getCell(5).value ?? "").trim().toUpperCase();
  const gamesRaw = String(row.getCell(6).value ?? "").trim();
  const location = String(row.getCell(7).value ?? "").trim();
  const notes = String(row.getCell(8).value ?? "").trim();
  const inApp = String(row.getCell(9).value ?? "").trim();

  if (!date && !type && !teamA && !teamB) return; // empty row
  if (inApp) { skipped++; return; }
  if (notes.toUpperCase().includes("EXAMPLE")) { skipped++; return; }

  try {
    const mappedType = TYPE_MAP[type];
    if (!mappedType) throw new ValidationError(`Unknown type "${type}"`);
    if (!date) throw new ValidationError("Missing date (YYYY-MM-DD)");
    const aIds = parseTeam(teamA);
    const bIds = parseTeam(teamB);
    const games = gamesRaw
      ? (gamesRaw.split(/[,\s]+/).map((g) => g.trim().toUpperCase()) as ("A" | "B")[])
      : [];
    const input: MatchInput = {
      type: mappedType,
      playedAt: date,
      participants: [
        ...aIds.map((playerId) => ({ playerId, side: "A" as const })),
        ...bIds.map((playerId) => ({ playerId, side: "B" as const })),
      ],
      games,
      winnerSide: winner === "A" || winner === "B" ? winner : undefined,
      location: location || null,
      gameTitle: "EA FC 26",
      notes: notes || null,
      screenshotUrl: null,
    };
    validateMatchInput(input, new Map(players.map((p) => [p.id, { active: p.active }])));
    parsed.push({ row: rowNumber, input });
  } catch (err) {
    errors.push({ row: rowNumber, error: err instanceof Error ? err.message : String(err) });
  }
});

const typeLabel: Record<string, string> = {
  single: "Single", best_of_3: "Bo3", multiplayer: "MP", multiplayer_best_of_3: "MP Bo3",
};
console.log(`\n📄 ${file}`);
console.log(`   ${parsed.length} match(es) ready · ${errors.length} with errors · ${skipped} skipped\n`);
for (const p of parsed) {
  const names = (id: number) => players.find((x) => x.id === id)!.nickname || players.find((x) => x.id === id)!.name;
  const a = p.input.participants.filter((x) => x.side === "A").map((x) => names(x.playerId)).join("+");
  const b = p.input.participants.filter((x) => x.side === "B").map((x) => names(x.playerId)).join("+");
  const games = p.input.games.length ? ` games ${p.input.games.join("")}` : "";
  console.log(`   ✓ row ${String(p.row).padStart(3)}  ${p.input.playedAt}  ${typeLabel[p.input.type].padEnd(6)} ${a} vs ${b} → ${p.input.winnerSide}${games}`);
}
for (const e of errors) console.log(`   ✗ row ${String(e.row).padStart(3)}  ${e.error}`);

if (errors.length > 0) {
  console.log("\n❌ Fix the rows above in the sheet and re-run. Nothing was recorded.");
  process.exit(1);
}
if (parsed.length === 0) {
  console.log("Nothing to import.");
  process.exit(0);
}
if (!apply) {
  console.log("\n👀 Preview only — re-run with --apply to record these matches.");
  process.exit(0);
}

// Record via the API (admin session).
const login = await fetch(`${apiUrl}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: adminUser, password: adminPass }),
});
if (!login.ok) {
  console.error(`\n❌ Admin login failed (${login.status}). If you changed the password, set LEAGUE_ADMIN_PASSWORD and re-run.`);
  process.exit(1);
}
const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

let ok = 0;
for (const p of parsed) {
  const res = await fetch(`${apiUrl}/api/matches`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(p.input),
  });
  if (res.ok) ok++;
  else {
    const data = await res.json().catch(() => ({}));
    console.log(`   ✗ row ${p.row}: ${data.error ?? res.status}`);
  }
}
console.log(`\n✅ ${ok}/${parsed.length} matches recorded. Standings and awards updated automatically.`);
console.log("   Remember to tick the \"In app?\" column (or delete those rows) in the shared sheet.");
