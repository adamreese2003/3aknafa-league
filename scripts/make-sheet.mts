/**
 * Generates the 3AKNAFA LEAGUE match-log workbook for the friends' group.
 * Upload the .xlsx to Google Drive â†’ opens as a Google Sheet with all tabs,
 * dropdowns and instructions intact.
 *
 * Run: npx tsx scripts/make-sheet.mts
 */
import ExcelJS from "exceljs";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { getAllPlayers } from "../lib/players";

const OUT_NAME = "3AKNAFA-match-log.xlsx";

const players = getAllPlayers();
const activeNames = players.filter((p) => p.active).map((p) => p.nickname || p.name);

const TYPES = ["Single", "Best of 3", "Multiplayer", "Multiplayer Bo3"];

const wb = new ExcelJS.Workbook();
wb.creator = "3AKNAFA LEAGUE";

/* ---------------- Tab 1: READ ME ---------------- */
const readme = wb.addWorksheet("READ ME", { properties: { tabColor: { argb: "FF`C9F73B" } } });
readme.columns = [{ width: 110 }];
const readMeLines: [string, boolean][] = [
  ["âš½ 3AKNAFA LEAGUE â€” MATCH LOG (fill one row per match, oldest first)", true],
  ["", false],
  ["HOW IT WORKS", true],
  ["1. After every match (or at the end of the night), add ONE row in the 'Match Log' tab.", false],
  ["2. Use the dropdowns for Type and Winner â€” don't type them manually.", false],
  ["3. Player names MUST be copied exactly as written in the 'Players' tab (copy-paste is safest).", false],
  ["4. Multiplayer = teams. Put teammates on one side, separated by + (example: Khalfy+Baden).", false],
  ["5. Best of 3 / Multiplayer Bo3: fill the Games column like A,B,A (A won game 1, B won game 2, A won game 3).", false],
  ["   The series MUST end 2-0 or 2-1 and stop as soon as someone reaches 2 wins. Winner column must match.", false],
  ["6. Leave Location / Notes empty if you don't need them.", false],
  ["7. Do NOT touch the 'In app?' column â€” that's for the admin after the match is entered in the league app.", false],
  ["", false],
  ["THE GOLDEN RULES", true],
  ["â€¢ A player cannot be on both teams in the same match.", false],
  ["â€¢ A match must have a winner. If you can't agree who won, it didn't count ðŸ˜„", false],
  ["â€¢ Wrong player name = the row can't be imported â€” copy from the Players tab.", false],
  ["", false],
  ["POINTS (the app calculates everything â€” this is just for reference)", true],
  ["â€¢ Single: winner +1    â€¢ Best of 3: series winner +2    â€¢ Multiplayer: each winner +1    â€¢ Multiplayer Bo3: each winner +2", false],
  ["Losers always get 0. One Best-of-3 series counts as ONE match, not three.", false],
];
readMeLines.forEach(([text, bold]) => {
  const row = readme.addRow([text]);
  const cell = row.getCell(1);
  cell.font = bold
    ? { bold: true, size: 12, color: { argb: "FFC9F73B" } }
    : { size: 11, color: { argb: "FFE8EDF3" } };
  cell.alignment = { vertical: "middle" };
});
readme.views = [{ state: "frozen", ySplit: 0 }];

/* ---------------- Tab 2: Match Log ---------------- */
const log = wb.addWorksheet("Match Log", { properties: { tabColor: { argb: "FF`58D5E8" } } });
const headers = [
  "Date (YYYY-MM-DD)",
  "Type",
  "Team A",
  "Team B",
  "Winner (A/B)",
  "Games (Bo3 only, e.g. A,B,A)",
  "Location (optional)",
  "Notes (optional)",
  "In app? (admin only)",
];
const headerRow = log.addRow(headers);
headerRow.eachCell((cell) => {
  cell.font = { bold: true, color: { argb: "FF0A0F17" }, size: 11 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC9F73B" } };
  cell.alignment = { vertical: "middle", wrapText: true };
  cell.border = {
    top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" },
  };
});
log.columns = [
  { width: 18 }, { width: 16 }, { width: 26 }, { width: 26 }, { width: 12 },
  { width: 24 }, { width: 20 }, { width: 34 }, { width: 18 },
];
log.views = [{ state: "frozen", ySplit: 1 }];

const exampleRows = [
  ["2026-09-23", "Single", "Khalfy", "Zingo", "A", "", "The Den", "EXAMPLE ROW â€” delete before use", ""],
  ["2026-09-23", "Best of 3", "Khalfy", "El Natra", "A", "A,B,A", "The Den", "EXAMPLE ROW â€” delete before use", ""],
  ["2026-09-23", "Multiplayer", "Khalfy+Baden", "El Natra+Zingo", "B", "", "The Den", "EXAMPLE ROW â€” delete before use", ""],
  ["2026-09-23", "Multiplayer Bo3", "El Tafa+El Natra", "Benloty+Twinkies", "A", "A,A", "The Den", "EXAMPLE ROW â€” delete before use", ""],
];
exampleRows.forEach((r) => {
  const row = log.addRow(r);
  row.eachCell((cell) => {
    cell.font = { italic: true, color: { argb: "FF9AA7B5" }, size: 10 };
    cell.border = {
      top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" },
    };
  });
});

// exceljs 4.4 ships dataValidations at runtime but not in its types.
type ValidationsHolder = {
  dataValidations: { add: (range: string, rule: Record<string, unknown>) => void };
};
const addValidation = (range: string, rule: Record<string, unknown>) =>
  (log as unknown as ValidationsHolder).dataValidations.add(range, rule);

// Dropdowns for rows 5â€“500 (examples live in rows 2â€“5).
addValidation("B5:B500", {
  type: "list",
  allowBlank: true,
  formulae: [`"${TYPES.join(",")}"`],
  showErrorMessage: true,
  errorTitle: "Pick from the list",
  error: "Choose one of the four match types.",
});
addValidation("E5:E500", {
  type: "list",
  allowBlank: true,
  formulae: ['"A,B"'],
  showErrorMessage: true,
  errorTitle: "A or B",
  error: "Which team won? A or B.",
});
// Date format on the whole Date column (no blank rows materialized).
log.getColumn(1).numFmt = "yyyy-mm-dd";

/* ---------------- Tab 3: Players ---------------- */
const roster = wb.addWorksheet("Players", { properties: { tabColor: { argb: "FF`F05636" } } });
roster.columns = [{ width: 28 }, { width: 26 }, { width: 12 }];
const rosterHeader = roster.addRow(["Exact name to use", "Full name", "Club"]);
rosterHeader.eachCell((cell) => {
  cell.font = { bold: true, color: { argb: "FF0A0F17" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF58D5E8" } };
});
players.forEach((p) => {
  const row = roster.addRow([(p.nickname || p.name), p.name, p.club ?? ""]);
  row.getCell(1).font = { bold: true, color: { argb: "FFFF7A59" } };
  row.getCell(1).note = "Copy-paste this exact spelling into Team A / Team B.";
});
roster.addRow([]);
roster.addRow(["Inactive players cannot play new matches."]).getCell(1).font = {
  italic: true, color: { argb: "FF9AA7B5" },
};

/* ---------------- Save ---------------- */
const targets = [path.join(process.cwd(), OUT_NAME)];
const desktop = path.join(os.homedir(), "Desktop");
if (fs.existsSync(desktop)) targets.push(path.join(desktop, OUT_NAME));

for (const t of targets) {
  await wb.xlsx.writeFile(t);
  console.log("written:", t);
}
console.log("roster included:", activeNames.join(", "));
