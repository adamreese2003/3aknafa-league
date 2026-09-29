/**
 * Node-side verification of the static site's parse+stats pipeline.
 * Loads the real live sheet CSV, injects a synthetic real match row,
 * and runs the same logic as docs/app.js (copy of the pure functions).
 */
const SHEET_ID = "1uqHbsa7qm0Akogk_j9EtCl7_6NCakKOQyK4rB105NGI";

const parseCSV = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
};

const toISODate = (value) => {
  if (!value) return null;
  const s = String(value).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
};

const TYPE_MAP = {
  single: "single",
  "best of 3": "best_of_3",
  multiplayer: "multiplayer",
  "multiplayer bo3": "multiplayer_best_of_3",
};

const roster = [
  ["Baden", "Baden Ahmed Baden"], ["El 3agoz", "El 3agoz"], ["El A2r3", "El A2r3"],
  ["El Natra", "El Natra"], ["El Tafa", "El Tafa"], ["Khalfy", "Khalfy"],
  ["Shb Zayed", "Shb Zayed"], ["Twinkies", "Twinkies"], ["Benloty", "Benloty"], ["Zingo", "Zingo"],
];
const byName = new Map();
roster.forEach(([nick, full], i) => {
  byName.set(full.toLowerCase(), i + 1);
  byName.set(nick.toLowerCase(), i + 1);
});

const POINTS = { single: 1, best_of_3: 2, multiplayer: 1, multiplayer_best_of_3: 2 };

function parseMatches(csv) {
  const rows = parseCSV(csv).slice(1);
  const matches = [];
  const rejected = [];
  for (const r of rows) {
    const date = toISODate(r[0]);
    const type = TYPE_MAP[String(r[1] || "").trim().toLowerCase()];
    const teamA = String(r[2] || "").trim();
    const teamB = String(r[3] || "").trim();
    const winner = String(r[4] || "").trim().toUpperCase();
    const gamesRaw = String(r[5] || "").trim();
    const notes = String(r[7] || "").trim();
    if (!date && !teamA && !teamB) continue;
    if (/example/i.test(notes)) continue;
    try {
      if (!type) throw new Error(`unknown type "${r[1]}"`);
      if (!date) throw new Error("missing date");
      const side = (raw) =>
        raw.split("+").map((s) => s.trim()).filter(Boolean).map((name) => {
          const id = byName.get(name.toLowerCase());
          if (!id) throw new Error(`unknown player "${name}"`);
          return id;
        });
      const A = side(teamA);
      const B = side(teamB);
      const games = gamesRaw ? gamesRaw.split(/[,\s]+/).map((g) => g.trim().toUpperCase()) : [];
      if (winner !== "A" && winner !== "B") throw new Error("no winner");
      if (!A.length || !B.length) throw new Error("empty team");
      if (A.some((id) => B.includes(id))) throw new Error("player on both teams");
      const isBo3 = type === "best_of_3" || type === "multiplayer_best_of_3";
      if (isBo3) {
        const a = games.filter((g) => g === "A").length;
        const b = games.length - a;
        if (Math.max(a, b) !== 2 || games.length > 3 || games.length < 2)
          throw new Error("Bo3 must end 2-0 or 2-1");
      }
      matches.push({ type, date, winner, games, A, B, notes: notes || null });
    } catch (err) {
      rejected.push({ row: matches.length + rejected.length + 2, reason: err.message });
    }
  }
  return { matches, rejected };
}

function computeStats(matches) {
  const stats = new Map();
  const get = (id) => {
    if (!stats.has(id)) stats.set(id, { id, mp: 0, wins: 0, losses: 0, points: 0 });
    return stats.get(id);
  };
  for (const m of matches) {
    const pts = POINTS[m.type];
    for (const id of m.A) {
      const s = get(id); s.mp++;
      if (m.winner === "A") { s.wins++; s.points += pts; } else s.losses++;
    }
    for (const id of m.B) {
      const s = get(id); s.mp++;
      if (m.winner === "B") { s.wins++; s.points += pts; } else s.losses++;
    }
  }
  for (const s of stats.values()) s.winPct = s.mp ? (s.wins / s.mp) * 100 : 0;
  return stats;
}

let failed = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
};

const name = (id) => roster[id - 1][0];

(async () => {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Match%20Log`;
  const res = await fetch(csvUrl);
  const liveCSV = await res.text();
  check("live sheet CSV fetched", res.status, 200);

  // Current sheet: only examples → 0 valid matches.
  const clean = parseMatches(liveCSV);
  check("examples skipped, 0 matches", clean.matches.length, 0);
  check("4 example rows skipped (not rejected)", clean.rejected.length, 0);

  // Inject the real match (El Tafa vs Twinkies, Sep 28 2026) as row 6 would.
  const line6 = '"2026-09-28","Single","El Tafa","Twinkies","A","","The Den","",""';
  const injected = liveCSV.trimEnd() + "\n" + line6;
  const withReal = parseMatches(injected);
  check("real row parsed as 1 match", withReal.matches.length, 1);
  const m = withReal.matches[0];
  check("match fields", [m.date, m.type, m.winner, m.A, m.B], ["2026-09-28", "single", "A", [5], [8]]);
  const stats = computeStats(withReal.matches);
  check("El Tafa: 1 MP 1W +1pt 100%", [stats.get(5).mp, stats.get(5).wins, stats.get(5).points, Math.round(stats.get(5).winPct)], [1, 1, 1, 100]);
  check("Twinkies: 1 MP 1L 0pt 0%", [stats.get(8).mp, stats.get(8).losses, stats.get(8).points, Math.round(stats.get(8).winPct)], [1, 1, 0, 0]);

  // A malformed row must be rejected, not crash.
  const badCSV = injected + '\n"2026-09-29","Best of 3","Khalfy","Baden","A","A","The Den","",""';
  const withBad = parseMatches(badCSV);
  check("valid row still parses alongside bad row", withBad.matches.length, 1);
  check("bad Bo3 (ends 1-0) rejected", withBad.rejected.map((r) => r.reason), ["Bo3 must end 2-0 or 2-1"]);

  console.log(failed === 0 ? "\n✅ PIPELINE VERIFIED" : `\n❌ ${failed} failures`);
  process.exit(failed ? 1 : 0);
})();
