/* 3AKNAFA LEAGUE — static edition
 * Live data source: the squad's Google Sheet (Match Log + Players tabs).
 * All statistics are computed client-side with the same rules as the full app:
 *   - standings rank by win % (then wins, matches, points)
 *   - 1 Bo3 series = 1 match; points: single 1 / Bo3 2 / MP 1 / MP Bo3 2
 *   - monthly awards by win % with a 5-match minimum; identical records tie
 *     (EL ZABEER shared, no 3AKNOFY awarded)
 *   - "carried" detector: team win% − solo win% ≥ 25 (min 3 matches each)
 */
"use strict";

const SHEET_ID = "1uqHbsa7qm0Akogk_j9EtCl7_6NCakKOQyK4rB105NGI";
const SEASON_START = { y: 2026, m: 9 };
const SEASON_END = { y: 2027, m: 9 };
const MIN_MONTHLY_MATCHES = 5;
const POINTS = { single: 1, best_of_3: 2, multiplayer: 1, multiplayer_best_of_3: 2 };
const TYPE_LABELS = {
  single: "Single Match",
  best_of_3: "Best of 3",
  multiplayer: "Multiplayer",
  multiplayer_best_of_3: "Multiplayer Bo3",
};
const LEAGUE_NAME = "3AKNAFA LEAGUE";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;

/* Known photo files (relative to this site). Anyone else gets initials. */
const PHOTO_MAP = {
  baden: "baden.jpeg",
  "baden ahmed baden": "baden.jpeg",
  "el 3agoz": "el-3agoz.jpeg",
  "el a2r3": "el-a2r3.jpeg",
  "el natra": "el-natra.jpeg",
  "el tafa": "el-tafa.jpeg",
  khalfy: "khalfy.jpeg",
  "shb zayed": "shb-zayed.jpeg",
  twinkies: "twinkies.jpeg",
  benloty: "benloty.jpeg",
  zingo: "zingo.jpeg",
};

const photoFor = (name) => {
  const file = PHOTO_MAP[String(name || "").toLowerCase()];
  return file ? `assets/players/${file}` : null;
};

const FALLBACK_ROSTER = [
  ["Baden", "Baden Ahmed Baden", "Real Madrid"],
  ["El 3agoz", "El 3agoz", "Barcelona"],
  ["El A2r3", "El A2r3", "Liverpool"],
  ["El Natra", "El Natra", "Man City"],
  ["El Tafa", "El Tafa", "Bayern"],
  ["Khalfy", "Khalfy", "PSG"],
  ["Shb Zayed", "Shb Zayed", "Chelsea"],
  ["Twinkies", "Twinkies", "Arsenal"],
  ["Benloty", "Benloty", "Juventus"],
  ["Zingo", "Zingo", "Inter"],
];

/* ---------------- data loading ---------------- */

const csvUrls = (sheetName) => {
  const direct = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
    sheetName
  )}`;
  return [
    direct,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(direct)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(direct)}`,
  ];
};

async function fetchCSV(sheetName) {
  let lastErr;
  for (const url of csvUrls(sheetName)) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text && text.length > 10) return text;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Could not reach the league sheet");
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function toISODate(value) {
  if (!value) return null;
  const s = String(value).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${m[3]}-${pad(m[1])}-${pad(m[2])}`;
  }
  return null;
}

const TYPE_MAP = {
  single: "single",
  "best of 3": "best_of_3",
  multiplayer: "multiplayer",
  "multiplayer bo3": "multiplayer_best_of_3",
};

async function loadLeague() {
  // 1) Published snapshot from the admin app (docs/data/league-data.json).
  try {
    const res = await fetch("data/league-data.json", { cache: "no-cache" });
    if (res.ok) {
      const j = await res.json();
      if (j && Array.isArray(j.players) && Array.isArray(j.matches) && j.matches.length >= 0) {
        const players = j.players.map((p) => ({
          id: p.id,
          name: p.name,
          nickname: p.nickname || null,
          club: p.club || null,
          photo: photoFor(p.nickname && p.nickname !== p.name ? p.nickname : p.name),
        }));
        const matches = j.matches
          .map((m, i) => ({ ...m, id: m.id || i + 1 }))
          .sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
        return {
          players,
          matches,
          rejected: [],
          from: "snapshot",
          fetchedAt: new Date(j.exportedAt || Date.now()),
        };
      }
    }
  } catch (_) {
    /* fall through to the live sheet */
  }

  // 2) Live Google Sheet fallback (friends' remote entries).
  let rosterRows = FALLBACK_ROSTER.map((r) => [r[0], r[1], r[2]]);
  try {
    const parsed = parseCSV(await fetchCSV("Players"));
    const fromSheet = parsed
      .slice(1)
      .map((r) => [String(r[0] || "").trim(), String(r[1] || "").trim(), String(r[2] || "").trim()])
      .filter((r) => r[0] && r[0] !== "Inactive players cannot play new matches.")
      .filter((r) => !/^exact name/i.test(r[0]));
    if (fromSheet.length >= 2) rosterRows = fromSheet;
  } catch (_) {
    /* roster fallback already set */
  }

  const players = rosterRows.map(([nick, full, club], i) => {
    const key = (nick || full).toLowerCase();
    return {
      id: i + 1,
      name: full || nick,
      nickname: nick !== full ? nick : null,
      club: club || null,
      photo: PHOTO_MAP[key] ? `assets/players/${PHOTO_MAP[key]}` : null,
    };
  });
  const byName = new Map();
  for (const p of players) {
    byName.set(p.name.toLowerCase(), p.id);
    byName.set(displayName(p).toLowerCase(), p.id);
  }

  const csv = await fetchCSV("Match Log");
  const rows = parseCSV(csv).slice(1);
  const matches = [];
  let rejected = [];
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
        raw
          .split("+")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((name) => {
            const id = byName.get(name.toLowerCase());
            if (!id) throw new Error(`unknown player "${name}"`);
            return id;
          });
      const A = side(teamA);
      const B = side(teamB);
      const games = gamesRaw
        ? gamesRaw
            .split(/[,\s]+/)
            .map((g) => g.trim().toUpperCase())
            .filter((g) => g === "A" || g === "B")
        : [];
      if (winner !== "A" && winner !== "B") throw new Error("no winner");
      if (!A.length || !B.length) throw new Error("empty team");
      if (A.some((id) => B.includes(id))) throw new Error("player on both teams");
      const isBo3 = type === "best_of_3" || type === "multiplayer_best_of_3";
      if (isBo3) {
        const a = games.filter((g) => g === "A").length;
        const b = games.length - a;
        if (Math.max(a, b) !== 2 || games.length > 3 || games.length < 2)
          throw new Error("Bo3 must end 2-0 or 2-1");
        if ((a === 2 && winner !== "A") || (b === 2 && winner !== "B"))
          throw new Error("winner doesn't match games");
      }
      matches.push({
        id: matches.length + 1,
        type,
        date,
        winner,
        games,
        location: String(r[6] || "").trim() || null,
        notes: notes || null,
        A,
        B,
      });
    } catch (err) {
      rejected.push({ row: matches.length + rejected.length + 2, reason: err.message });
    }
  }
  matches.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  return { players, matches, rejected, from: "sheet", fetchedAt: new Date() };
}

/* ---------------- statistics engine ---------------- */

function displayName(p) {
  return p.nickname || p.name;
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
      const s = get(id);
      s.mp++;
      if (m.winner === "A") {
        s.wins++;
        s.points += pts;
      } else s.losses++;
    }
    for (const id of m.B) {
      const s = get(id);
      s.mp++;
      if (m.winner === "B") {
        s.wins++;
        s.points += pts;
      } else s.losses++;
    }
  }
  for (const s of stats.values()) s.winPct = s.mp ? (s.wins / s.mp) * 100 : 0;
  return stats;
}

function computeStandings(players, stats) {
  const rows = players.map((p) => stats.get(p.id) || { id: p.id, mp: 0, wins: 0, losses: 0, points: 0, winPct: 0 });
  rows.sort(
    (a, b) =>
      b.wins - a.wins ||
      b.winPct - a.winPct ||
      b.mp - a.mp ||
      b.points - a.points ||
      displayName(players.find((p) => p.id === a.id)).localeCompare(
        displayName(players.find((p) => p.id === b.id))
      )
  );
  let lastRank = 0;
  let lastKey = "";
  return rows.map((r, i) => {
    const key = `${r.wins}|${r.winPct}|${r.mp}|${r.points}`;
    const rank = key === lastKey ? lastRank : i + 1;
    lastRank = rank;
    lastKey = key;
    return { ...r, rank, tied: rows.filter((x) => `${x.wins}|${x.winPct}|${x.mp}|${x.points}` === key).length > 1 };
  });
}

const monthKey = (date) => date.slice(0, 7);

function seasonMonths() {
  const months = [];
  let { y, m } = SEASON_START;
  const end = SEASON_END.y * 12 + SEASON_END.m;
  while (y * 12 + m <= end) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return months;
}

function formatMonth(mo) {
  const [y, m] = mo.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function monthlyAwards(matches, month) {
  const monthly = matches.filter((m) => monthKey(m.date) === month);
  const stats = [...computeStats(monthly).values()].filter((s) => s.mp >= MIN_MONTHLY_MATCHES);
  stats.sort(
    (a, b) =>
      b.winPct - a.winPct ||
      b.wins - a.wins ||
      b.mp - a.mp ||
      b.points - a.points
  );
  const key = (s) => `${s.winPct}|${s.wins}|${s.mp}|${s.points}`;
  const best = stats[0] || null;
  const last = stats.length >= 2 ? stats[stats.length - 1] : null;
  const allTied = !!best && !!last && key(best) === key(last);
  return {
    month,
    totalMatches: monthly.length,
    qualifiers: stats.length,
    best,
    bestTied: best ? stats.filter((s) => s.id !== best.id && key(s) === key(best)).map((s) => s.id) : [],
    worst: allTied ? null : last,
    worstTied:
      !allTied && last ? stats.filter((s) => s.id !== last.id && key(s) === key(last)).map((s) => s.id) : [],
    allTied,
  };
}

function formatBreakdown(matches, playerId) {
  const fmt = {};
  for (const m of matches) {
    const me = m.A.includes(playerId) ? "A" : m.B.includes(playerId) ? "B" : null;
    if (!me) continue;
    const f = (fmt[m.type] = fmt[m.type] || { played: 0, wins: 0 });
    f.played++;
    if (me === m.winner) f.wins++;
  }
  const sum = (types) =>
    types.reduce(
      (acc, t) => {
        const v = fmt[t];
        return { played: acc.played + (v ? v.played : 0), wins: acc.wins + (v ? v.wins : 0) };
      },
      { played: 0, wins: 0 }
    );
  const solo = sum(["single", "best_of_3"]);
  const team = sum(["multiplayer", "multiplayer_best_of_3"]);
  const pct = (v) => (v.played ? (v.wins / v.played) * 100 : 0);
  const enough = solo.played >= 3 && team.played >= 3;
  return {
    fmt,
    solo,
    team,
    soloPct: pct(solo),
    teamPct: pct(team),
    carried: enough && pct(team) - pct(solo) >= 25,
    loneWolf: enough && pct(solo) - pct(team) >= 25,
  };
}

/* ---------------- streaks & head-to-head ---------------- */

function computeStreaks(matches) {
  const chrono = [...matches].sort((a, b) =>
    a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1
  );
  const seqs = new Map();
  for (const m of chrono) {
    for (const side of ["A", "B"]) {
      for (const id of m[side]) {
        const seq = seqs.get(id) || [];
        seq.push(side === m.winner ? "W" : "L");
        seqs.set(id, seq);
      }
    }
  }
  const out = new Map();
  for (const [id, seq] of seqs) {
    let bestW = 0;
    let worstL = 0;
    let runType = seq[0];
    let runLen = 0;
    for (const r of seq) {
      if (r === runType) runLen++;
      else {
        if (runType === "W") bestW = Math.max(bestW, runLen);
        else worstL = Math.max(worstL, runLen);
        runType = r;
        runLen = 1;
      }
    }
    if (runType === "W") bestW = Math.max(bestW, runLen);
    else worstL = Math.max(worstL, runLen);
    const last = seq[seq.length - 1];
    let count = 0;
    for (let i = seq.length - 1; i >= 0 && seq[i] === last; i--) count++;
    out.set(id, { current: { type: last, count }, bestWinStreak: bestW, worstLossStreak: worstL });
  }
  return out;
}

function headToHead(matches, aId, bId) {
  const meetings = matches
    .filter((m) => {
      const aSide = m.A.includes(aId) ? "A" : m.B.includes(aId) ? "B" : null;
      const bSide = m.A.includes(bId) ? "A" : m.B.includes(bId) ? "B" : null;
      return aSide && bSide && aSide !== bSide;
    })
    .sort((x, y) => (x.date === y.date ? y.id - x.id : x.date < y.date ? 1 : -1));

  let aWins = 0;
  let bWins = 0;
  const byFormat = {};
  const results = []; // from a's perspective, oldest-first for streak math
  for (const m of [...meetings].reverse()) {
    const aSide = m.A.includes(aId) ? "A" : "B";
    const aWon = aSide === m.winner;
    if (aWon) {
      aWins++;
      results.push("A");
    } else {
      bWins++;
      results.push("B");
    }
    const f = (byFormat[m.type] = byFormat[m.type] || { a: 0, b: 0 });
    if (aWon) f.a++;
    else f.b++;
  }

  let longestA = 0;
  let longestB = 0;
  let runType = null;
  let runLen = 0;
  for (const r of [...results].reverse()) {
    if (r === runType) runLen++;
    else {
      if (runType === "A") longestA = Math.max(longestA, runLen);
      if (runType === "B") longestB = Math.max(longestB, runLen);
      runType = r;
      runLen = 1;
    }
  }
  if (runType === "A") longestA = Math.max(longestA, runLen);
  if (runType === "B") longestB = Math.max(longestB, runLen);

  let currentDuel = null;
  if (results.length) {
    const last = results[results.length - 1];
    let count = 0;
    for (let i = results.length - 1; i >= 0 && results[i] === last; i--) count++;
    currentDuel = { winnerId: last === "A" ? aId : bId, count };
  }

  return { aId, bId, aWins, bWins, currentDuel, longestAStreak: longestA, longestBStreak: longestB, byFormat, meetings };
}

/* ---------------- rendering ---------------- */

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function avatar(p, cls = "") {
  const name = displayName(p);
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const img = p.photo
    ? `<img src="${esc(p.photo)}" alt="${esc(name)}" loading="lazy" onerror="this.remove()">`
    : "";
  return `<span class="avatar ${cls}">${img}${img ? "" : initials}</span>`;
}

function navHTML(route) {
  const path = (route || "#/").split("?")[0];
  const links = [
    ["#/", "Dashboard", path === "#/" || path === ""],
    ["#/standings", "Standings", path === "#/standings"],
    ["#/players", "Players", path.startsWith("#/players")],
    ["#/matches", "Matches", path === "#/matches"],
    ["#/h2h", "Head-to-Head", path === "#/h2h"],
    ["#/awards", "Awards", path === "#/awards"],
  ];
  return links
    .map(([href, label, active]) => `<a href="${href}" class="${active ? "active" : ""}">${label}</a>`)
    .join("");
}

function matchCardHTML(m, players) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const side = (ids, sideKey) => {
    const won = m.winner === sideKey;
    const rows = ids
      .map((id) => {
        const p = byId.get(id);
        if (!p) return "";
        return `<div class="team-player ${won ? "winner" : ""}">${
          sideKey === "B" ? `<span>${esc(displayName(p))}</span>` : ""
        }${avatar(p, won ? "ring sm" : "sm")}${sideKey === "A" ? `<span>${esc(displayName(p))}</span>` : ""}</div>`;
      })
      .join("");
    return `<div class="team-side ${sideKey === "B" ? "right" : ""}">${rows}</div>`;
  };
  const isBo3 = m.type === "best_of_3" || m.type === "multiplayer_best_of_3";
  const a = m.games.filter((g) => g === "A").length;
  const b = m.games.length - a;
  const score = isBo3 ? (m.winner === "A" ? `${a}–${b}` : `${b}–${a}`) : "VS";
  const pts = POINTS[m.type];
  return `<article class="glass match-card">
    <div class="match-meta">
      <span class="badge ${isBo3 ? "ice" : "plain"}">${TYPE_LABELS[m.type]}</span>
      <span class="date">${formatDate(m.date)}</span>
      <span class="badge volt">+${pts} pt${pts === 1 ? "" : "s"}</span>
    </div>
    <div class="match-body">
      ${side(m.A, "A")}
      <div class="score-middle"><b>${score}</b><small>${isBo3 ? "SERIES" : "&nbsp;"}</small></div>
      ${side(m.B, "B")}
    </div>
    ${m.notes ? `<p class="match-notes">“${esc(m.notes)}”</p>` : ""}
  </article>`;
}

function standingsTableHTML(standings, players, sortKey = "rank", sortAsc = true) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const cols = [
    ["rank", "#"],
    ["name", ""],
    ["mp", "MP"],
    ["wins", "W"],
    ["losses", "L"],
    ["points", "Pts"],
    ["winPct", "Win %"],
  ];
  const head = cols
    .map(([key, label]) => {
      if (!label) return `<th>PLAYER</th>`;
      const arrow = sortKey === key ? (sortAsc ? " ▲" : " ▼") : "";
      return `<th class="sortable ${sortKey === key ? "sorted" : ""}" data-sort="${key}">${label}${arrow}</th>`;
    })
    .join("");
  const sorted = [...standings].sort((a, b) => {
    let d = 0;
    if (sortKey === "name")
      d = displayName(byId.get(a.id)).localeCompare(displayName(byId.get(b.id)));
    else d = (a[sortKey] || 0) - (b[sortKey] || 0);
    if (d === 0) d = a.rank - b.rank;
    return sortAsc ? d : -d;
  });
  const body = sorted
    .map((r) => {
      const p = byId.get(r.id);
      const cls = r.rank === 1 ? "rank-1" : r.rank === 2 ? "rank-2" : r.rank === 3 ? "rank-3" : "";
      return `<tr>
      <td class="rank-cell ${cls}">${r.rank}${r.tied ? " =" : ""}</td>
      <td><a class="player-cell" href="#/players/${r.id}">${avatar(p)}<b>${esc(displayName(p))}</b></a></td>
      <td>${r.mp}</td>
      <td class="wins">${r.wins}</td>
      <td class="losses">${r.losses}</td>
      <td class="pts">${r.points}</td>
      <td><span class="winbar">${r.winPct.toFixed(1)}%<span class="track"><span class="fill" style="width:${Math.round(
        r.winPct
      )}%"></span></span></span></td>
    </tr>`;
    })
    .join("");
  return `<div class="glass table-wrap"><table>
    <thead><tr>${head}</tr></thead><tbody>${body}</tbody>
  </table></div>`;
}

/* ---------------- pages ---------------- */

function pageDashboard(data) {
  const { players, matches } = data;
  const stats = computeStats(matches);
  const standings = computeStandings(players, stats);
  const month = new Date().toISOString().slice(0, 7);
  const awards = monthlyAwards(matches, month);
  const byId = new Map(players.map((p) => [p.id, p]));
  const totalPoints = [...stats.values()].reduce((n, s) => n + s.points, 0);
  const best = [...stats.values()].sort((a, b) => b.winPct - a.winPct || b.mp - a.mp)[0];

  const streaks = computeStreaks(matches);
  const streakChips = players
    .map((p) => ({ p, s: streaks.get(p.id) }))
    .filter((x) => x.s && x.s.current)
    .sort((x, y) => {
      const a = x.s.current;
      const b = y.s.current;
      if (a.type !== b.type) return a.type === "W" ? -1 : 1;
      return b.count - a.count;
    })
    .slice(0, 6)
    .map(({ p, s }) => {
      const hot = s.current.type === "W";
      return `<a href="#/players/${p.id}" class="badge ${hot ? "volt" : "ember"}" style="padding:6px 12px">${
        hot ? "🔥" : "❄️"
      } ${esc(displayName(p))} · ${s.current.count}${hot ? "W" : "L"}</a>`;
    })
    .join("");

  const awardCard = (kind, s, tied) => {
    if (!s)
      return `<div class="glass award-empty"><span class="icon">${kind === "best" ? "🏆" : "💀"}</span>
        <h3>${kind === "best" ? "EL ZABEER" : "3AKNOFY EL SHAHR"}</h3>
        <p>${awards.allTied ? "Dead tie — identical records, no skull this month." : `Needs ${MIN_MONTHLY_MATCHES} matches this month to qualify.`}</p></div>`;
    const group = [s, ...tied.map((id) => stats.get(id)).filter(Boolean)];
    const names = group.map((x) => displayName(byId.get(x.id))).join(" & ");
    const isBest = kind === "best";
    return `<a class="glass glass-hover award-card ${isBest ? "best" : "worst"}" href="#/players/${s.id}">
      <span class="award-glow"></span>
      <span class="badge ${isBest ? "volt" : "ember"}">${isBest ? "🏆 EL ZABEER" : "💀 3AKNOFY EL SHAHR"}${
      group.length > 1 ? " · TIE" : ""
    }</span>
      <div class="award-body">
        ${group.slice(0, 3).map((x) => avatar(byId.get(x.id), group.length > 1 ? "" : "lg")).join("")}
        <div><p class="award-name">${esc(names)}</p>
        <p class="award-pct">${s.winPct.toFixed(1)}%</p>
        <p class="award-sub">win rate this month${group.length > 1 ? " · identical records" : ""}</p></div>
      </div>
      <div class="award-stats">
        <div><b>${s.mp}</b><span>Matches</span></div>
        <div><b>${s.wins}</b><span>Wins</span></div>
        <div><b>${s.mp - s.wins}</b><span>Losses</span></div>
        <div><b>${s.points}</b><span>Points</span></div>
      </div></a>`;
  };

  const top5 = standings.slice(0, 5);
  const recent = matches.slice(0, 4);

  return `<section class="hero">
    <div class="hero-bg" style="background-image:url('assets/hero-gaming.jpeg')"></div>
    <div class="hero-shade"></div>
    <div class="hero-inner">
      <span class="eyebrow">Season 26/27 · ${formatMonth(month)}</span>
      <h1>3AKNAFA LEAGUE</h1>
      <p>The couch, the controllers, the bragging rights. Every match in the sheet counts here — standings and awards update on their own.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="#/standings">View standings</a>
        <a class="btn btn-ghost" href="#/matches">Match history</a>
      </div>
    </div>
  </section>
  <div class="wrap page">
    <div class="grid-stats">
      <div class="glass stat-card"><p class="stat-label">Players</p><p class="stat-value">${players.length}</p><p class="stat-sub">in the squad</p></div>
      <div class="glass stat-card"><p class="stat-value ice">${matches.length}</p><p class="stat-label">Matches played</p><p class="stat-sub">all formats</p></div>
      <div class="glass stat-card"><p class="stat-label">Highest win rate</p><p class="stat-value">${
        best ? best.winPct.toFixed(1) + "%" : "—"
      }</p><p class="stat-sub">${best ? esc(displayName(byId.get(best.id))) + " · " + best.wins + "W" : ""}</p></div>
      <div class="glass stat-card"><p class="stat-value ice">${totalPoints}</p><p class="stat-label">Total points</p><p class="stat-sub">earned all season</p></div>
    </div>

    ${
      streakChips
        ? `<section style="margin-bottom:44px">
            <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:14px">
              <h2 class="section-title">Streak watch <span style="color:var(--faint)">· hottest first</span></h2>
              <a href="#/standings" style="color:var(--volt-300);font-size:.85rem;font-weight:600">Standings →</a>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:10px">${streakChips}</div>
          </section>`
        : ""
    }

    <div class="award-grid">
      ${awardCard("best", awards.best, awards.bestTied)}
      ${awardCard("worst", awards.worst, awards.worstTied)}
    </div>

    <div class="two-col">
      <div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px">
          <h2 class="section-title">Top of the table <span style="color:var(--faint)">· by wins</span></h2>
          <a href="#/standings" style="color:var(--volt-300);font-size:.85rem;font-weight:600">Full table →</a>
        </div>
        ${standingsTableHTML(top5, players)}
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px">
          <h2 class="section-title">Latest results</h2>
          <a href="#/matches" style="color:var(--volt-300);font-size:.85rem;font-weight:600">History →</a>
        </div>
        <div class="match-list">${recent.map((m) => matchCardHTML(m, players)).join("") || ""}</div>
      </div>
    </div>
  </div>`;
}

function pageStandings(data, sortKey, sortAsc) {
  const standings = computeStandings(data.players, computeStats(data.matches));
  const streaks = computeStreaks(data.matches);
  const chipHTML = data.players
    .map((p) => ({ p, s: streaks.get(p.id) }))
    .filter((x) => x.s && x.s.current)
    .sort((x, y) => {
      const a = x.s.current;
      const b = y.s.current;
      if (a.type !== b.type) return a.type === "W" ? -1 : 1;
      return b.count - a.count;
    })
    .slice(0, 8)
    .map(({ p, s }) => {
      const hot = s.current.type === "W";
      return `<a href="#/players/${p.id}" class="badge ${hot ? "volt" : "ember"}" style="padding:6px 12px">${
        hot ? "🔥" : "❄️"
      } ${esc(displayName(p))} · ${s.current.count}${hot ? "W" : "L"}</a>`;
    })
    .join("");
  return `<div class="wrap page">
    <div class="page-head">
      <p class="eyebrow">League table</p>
      <h1>Standings</h1>
      <p>Ranked by total wins — consistency across the season is king — with win rate as the tiebreaker. Single win 1 pt · Bo3 win 2 pts · multiplayer win 1 pt each · MP Bo3 2 pts each — points still show in the Pts column. Tap a column to sort.</p>
    </div>
    <div id="tableHost">${standingsTableHTML(standings, data.players, sortKey, sortAsc)}</div>
    ${
      chipHTML
        ? `<section class="glass" style="margin-top:22px;padding:20px 22px;border-radius:18px">
            <h2 class="section-title" style="margin-bottom:14px">Current streaks</h2>
            <div style="display:flex;flex-wrap:wrap;gap:10px">${chipHTML}</div>
          </section>`
        : ""
    }
  </div>`;
}

function pagePlayers(data) {
  const stats = computeStats(data.matches);
  const standings = computeStandings(data.players, stats);
  const rankById = new Map(standings.map((r) => [r.id, r]));
  const cards = data.players
    .map((p) => {
      const s = stats.get(p.id) || { mp: 0, wins: 0, losses: 0, points: 0, winPct: 0 };
      const r = rankById.get(p.id);
      return `<a class="glass glass-hover player-card" href="#/players/${p.id}">
        <div class="top">
          ${avatar(p, r && r.rank === 1 ? "ring" : "")}
          <div style="min-width:0;flex:1">
            <p class="name">${esc(displayName(p))}</p>
            <p class="club">${esc(p.club || "No club")}</p>
            ${r && s.mp ? `<p class="rankline">RANK #${r.rank}</p>` : ""}
          </div>
        </div>
        <div class="ministats">
          <div><b>${s.mp}</b><span>MP</span></div>
          <div><b style="color:var(--volt-300)">${s.wins}</b><span>W</span></div>
          <div><b style="color:var(--ember-400)">${s.losses}</b><span>L</span></div>
          <div><b>${s.points}</b><span>Pts</span></div>
        </div>
        <p class="winrate">Win rate ${s.winPct.toFixed(1)}%</p>
      </a>`;
    })
    .join("");
  return `<div class="wrap page">
    <div class="page-head">
      <p class="eyebrow">The squad</p>
      <h1>Players</h1>
      <p>${data.players.length} in the roster · ${data.matches.length} matches recorded</p>
    </div>
    <div class="roster-cards">${cards}</div>
  </div>`;
}

function pageProfile(data, playerId) {
  const p = data.players.find((x) => x.id === playerId);
  if (!p) return pageNotFound();
  const all = data.matches;
  const mine = all.filter((m) => m.A.includes(p.id) || m.B.includes(p.id));
  const stats = computeStats(mine).get(p.id) || { mp: 0, wins: 0, losses: 0, points: 0, winPct: 0 };
  const standings = computeStandings(data.players, computeStats(all));
  const rank = standings.find((r) => r.id === p.id);
  const bd = formatBreakdown(all, p.id);
  const byId = new Map(data.players.map((x) => [x.id, x]));
  const streak = computeStreaks(all).get(p.id) || null;
  const streakHTML =
    streak && streak.current
      ? `<p style="margin:10px 0 0">
          <span class="badge ${streak.current.type === "W" ? "volt" : "ember"}">${
            streak.current.type === "W" ? "🔥" : "❄️"
          } ${streak.current.count}${streak.current.type === "W" ? "-match win streak" : "-match losing streak"}</span>
          <span style="margin-left:8px;font-size:.75rem;color:var(--faint)">best ${streak.bestWinStreak}W · worst ${streak.worstLossStreak}L</span>
        </p>`
      : "";
  const h2hLink =
    stats.mp > 0
      ? `<a href="#/h2h?a=${p.id}" style="display:inline-block;margin-top:12px;color:var(--volt-300);font-size:.85rem;font-weight:600">⚔️ Head-to-head records →</a>`
      : "";

  const months = [...new Set(mine.map((m) => monthKey(m.date)))].sort().reverse();
  const monthlyRows = months
    .map((mo) => {
      const ms = mine.filter((m) => monthKey(m.date) === mo);
      const s = computeStats(ms).get(p.id);
      return { mo, mp: s.mp, wins: s.wins, pct: (s.wins / s.mp) * 100 };
    })
    .filter((r) => r.mp > 0);

  const recent = mine.slice(0, 10).map((m) => {
    const side = m.A.includes(p.id) ? "A" : "B";
    const won = side === m.winner;
    const isBo3 = m.type === "best_of_3" || m.type === "multiplayer_best_of_3";
    const a = m.games.filter((g) => g === "A").length;
    const b = m.games.length - a;
    const opp = (side === "A" ? m.B : m.A)
      .map((id) => displayName(byId.get(id)))
      .join(" & ");
    return `<div class="recent-row">
      <span class="badge ${won ? "volt" : "ember"}">${won ? "WIN" : "LOSS"}</span>
      <div class="what"><b>vs ${esc(opp)} <span style="color:var(--faint);font-weight:400;font-size:.72rem">${
      isBo3 ? "Bo3" : TYPE_LABELS[m.type]
    }</span></b><small>${formatDate(m.date)}</small></div>
      <div class="res" style="color:${won ? "var(--volt-300)" : "var(--faint)"}">${
      isBo3 ? (side === "A" ? `${a}–${b}` : `${b}–${a}`) : ""
    }</div>
    </div>`;
  });

  const fmtCard = (key, label, isTeam) => {
    const v = bd.fmt[key] || { played: 0, wins: 0 };
    const pct = v.played ? (v.wins / v.played) * 100 : 0;
    return `<div class="fmt-card ${isTeam ? "team" : "solo"}">
      <small>${label}</small>
      <b>${v.played}<i> MP</i></b>
      <p>${v.wins}W · ${v.played - v.wins}L · ${pct.toFixed(1)}%</p>
      <div class="track"><div class="fill" style="width:${Math.round(pct)}%"></div></div>
    </div>`;
  };

  return `<div class="wrap page">
    <a class="backlink" href="#/players">← All players</a>
    <section class="profile-hero"><div class="bg"></div>
      <div class="inner">
        ${avatar(p, "lg ring")}
        <div>
          <span class="badge volt">${rank && stats.mp ? (rank.rank === 1 ? "👑 " : "") + "Rank #" + rank.rank + " of " + standings.filter((r) => r.mp > 0).length : "No matches yet"}</span>
          <h1>${esc(displayName(p))}</h1>
          <p class="sub">${esc(p.name)}${p.club ? " · " + esc(p.club) : ""}</p>
          ${streakHTML}
          ${h2hLink}
        </div>
      </div>
    </section>
    <div class="tiles">
      <div class="glass tile"><b style="color:var(--volt-300)">${stats.winPct.toFixed(1)}%</b><span>Win rate</span></div>
      <div class="glass tile"><b>${stats.mp}</b><span>Matches</span></div>
      <div class="glass tile"><b style="color:var(--volt-300)">${stats.wins}</b><span>Wins</span></div>
      <div class="glass tile"><b style="color:var(--ember-400)">${stats.losses}</b><span>Losses</span></div>
      <div class="glass tile"><b>${stats.points}</b><span>Points</span></div>
      <div class="glass tile"><b style="color:var(--ice-300)">${stats.mp ? (stats.points / stats.mp).toFixed(2) : "0.00"}</b><span>Pts / match</span></div>
    </div>

    <section class="glass panel" style="margin-top:26px">
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px">
        <h2 style="margin:0">Solo vs team matches</h2>
        <div class="chips">
          <span class="badge plain">SOLO: ${bd.solo.played} MP · ${bd.soloPct.toFixed(1)}%</span>
          <span class="badge ice">TEAMS: ${bd.team.played} MP · ${bd.teamPct.toFixed(1)}%</span>
        </div>
      </div>
      ${bd.carried ? `<p class="alert carried">🚗 Carried alert — wins almost exclusively in team matches. Somebody's riding a mate.</p>` : ""}
      ${bd.loneWolf ? `<p class="alert lone">🐺 Lone wolf — clearly better without a teammate.</p>` : ""}
      <div class="fmt-grid">
        ${fmtCard("single", "Single Match", false)}
        ${fmtCard("best_of_3", "Best of 3", false)}
        ${fmtCard("multiplayer", "Multiplayer", true)}
        ${fmtCard("multiplayer_best_of_3", "Multiplayer Bo3", true)}
      </div>
    </section>

    <div class="split-2">
      <section class="glass panel">
        <h2>Monthly performance</h2>
        ${
          monthlyRows.length
            ? `<table><thead><tr><th style="text-align:left">Month</th><th>MP</th><th>W</th><th>Win %</th></tr></thead><tbody>
          ${monthlyRows
            .map(
              (r) => `<tr><td style="text-align:left;color:rgba(255,255,255,.85)">${formatMonth(r.mo)}</td>
            <td>${r.mp}</td><td class="wins">${r.wins}</td>
            <td><span class="winbar">${r.pct.toFixed(1)}%<span class="track"><span class="fill" style="width:${Math.round(
                r.pct
              )}%"></span></span></span></td></tr>`
            )
            .join("")}</tbody></table>`
            : `<p style="color:var(--muted);font-size:.85rem;margin:0">No matches recorded yet.</p>`
        }
      </section>
      <section class="glass panel">
        <h2>Recent matches</h2>
        ${recent.length ? recent.join("") : `<p style="color:var(--muted);font-size:.85rem;margin:0">No matches recorded yet.</p>`}
      </section>
    </div>
  </div>`;
}

function pageMatches(data) {
  const months = seasonMonths();
  return `<div class="wrap page">
    <div class="page-head">
      <p class="eyebrow">Every game counts</p>
      <h1>Match history</h1>
      <p>Everything recorded in the squad's sheet, Sep 2026 → Sep 2027.</p>
    </div>
    <div class="glass filters">
      <div class="field"><label for="fPlayer">Player</label><select id="fPlayer"><option value="">All players</option>${data.players
        .map((p) => `<option value="${p.id}">${esc(displayName(p))}</option>`)
        .join("")}</select></div>
      <div class="field"><label for="fType">Match type</label><select id="fType"><option value="">All types</option>
        ${Object.entries(TYPE_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
      <div class="field"><label for="fMonth">Month</label><select id="fMonth"><option value="">All season</option>${months
        .map((mo) => `<option value="${mo}">${formatMonth(mo)}</option>`)
        .join("")}</select></div>
      <div class="field"><label for="fWinner">Winner</label><select id="fWinner"><option value="">Any winner</option>${data.players
        .map((p) => `<option value="${p.id}">${esc(displayName(p))}</option>`)
        .join("")}</select></div>
      <div class="field"><label>&nbsp;</label><button class="btn btn-ghost" id="fReset" style="width:100%">Reset</button></div>
    </div>
    <p id="matchCount" style="color:var(--muted);font-size:.85rem;margin:0 0 14px"></p>
    <div class="match-list" id="matchList"></div>
  </div>`;
}

function pageAwards(data) {
  const months = [...new Set(data.matches.map((m) => monthKey(m.date)))].sort().reverse();
  const month = new Date().toISOString().slice(0, 7);
  const visible = months.filter((mo) => mo !== month);
  const byId = new Map(data.players.map((p) => [p.id, p]));
  const history = visible.map((mo) => ({ mo, a: monthlyAwards(data.matches, mo) }));
  return `<section class="hero">
    <div class="hero-bg" style="background-image:url('assets/ucl-trophy.jpg')"></div>
    <div class="hero-shade"></div>
    <div class="hero-inner">
      <span class="eyebrow">Monthly awards</span>
      <h1 style="font-size:clamp(1.9rem,5vw,3.2rem)">${formatMonth(month)}</h1>
      <p>Ranked by win rate among players with at least ${MIN_MONTHLY_MATCHES} matches this month. Identical records are declared a tie — shared glory, no skull.</p>
    </div>
  </section>
  <div class="wrap page">
    ${(() => {
      const a = monthlyAwards(data.matches, month);
      const card = (kind) => {
        const s = kind === "best" ? a.best : a.worst;
        const tied = kind === "best" ? a.bestTied : a.worstTied;
        if (!s)
          return `<div class="glass award-empty"><span class="icon">${kind === "best" ? "🏆" : "💀"}</span>
            <h3>${kind === "best" ? "EL ZABEER" : "3AKNOFY EL SHAHR"}</h3>
            <p>${a.allTied ? "Dead tie — identical records, no skull awarded this month." : `A player needs ${MIN_MONTHLY_MATCHES} matches this month to qualify.`}</p></div>`;
        const names = [displayName(byId.get(s.id)), ...tied.map((id) => displayName(byId.get(id)) || "?")].join(" & ");
        const isBest = kind === "best";
        return `<a class="glass glass-hover award-card ${isBest ? "best" : "worst"}" href="#/players/${s.id}">
          <span class="award-glow"></span>
          <span class="badge ${isBest ? "volt" : "ember"}">${isBest ? "🏆 EL ZABEER" : "💀 3AKNOFY EL SHAHR"}${tied.length ? " · TIE" : ""}</span>
          <div class="award-body">
            ${avatar(byId.get(s.id), tied.length ? "" : "lg ring")}
            <div><p class="award-name">${esc(names)}</p>
            <p class="award-pct">${s.winPct.toFixed(1)}%</p>
            <p class="award-sub">win rate this month${tied.length ? " · identical records" : ""}</p></div>
          </div>
          <div class="award-stats">
            <div><b>${s.mp}</b><span>Matches</span></div>
            <div><b>${s.wins}</b><span>Wins</span></div>
            <div><b>${s.mp - s.wins}</b><span>Losses</span></div>
            <div><b>${s.points}</b><span>Points</span></div>
          </div></a>`;
      };
      return `<div class="award-grid">${card("best")}${card("worst")}</div>`;
    })()}

    <h2 class="section-title" style="margin-bottom:18px">Monthly history <span style="color:var(--faint)">· permanent record</span></h2>
    ${
      history.length
        ? history
            .map(({ mo, a }) => {
              const bestName = a.best ? [displayName(byId.get(a.best.id)), ...a.bestTied.map((id) => displayName(byId.get(id)) || "?")].join(" & ") : null;
              const worstName = a.worst ? [displayName(byId.get(a.worst.id)), ...a.worstTied.map((id) => displayName(byId.get(id)) || "?")].join(" & ") : null;
              return `<div class="glass history-item">
          <div class="history-head"><h3>${formatMonth(mo)}</h3><span>${a.totalMatches} matches · ${a.qualifiers} qualified</span></div>
          <div class="history-grid">
            ${
              a.best
                ? `<a class="history-pill best" href="#/players/${a.best.id}"><span class="icon">🏆</span>${avatar(
                    byId.get(a.best.id),
                    "sm"
                  )}<div style="min-width:0"><b>${esc(bestName)}${a.bestTied.length ? ' <span style="color:var(--volt-300);font-size:.65rem">TIE</span>' : ""}</b>
                <small>${a.best.winPct.toFixed(1)}% · ${a.best.wins}W / ${a.best.mp}</small></div></a>`
                : `<div class="history-pill none"><span class="icon" style="opacity:.4">🏆</span><small style="color:var(--faint)">No qualifier</small></div>`
            }
            ${
              a.worst
                ? `<a class="history-pill worst" href="#/players/${a.worst.id}"><span class="icon">💀</span>${avatar(
                    byId.get(a.worst.id),
                    "sm"
                  )}<div style="min-width:0"><b>${esc(worstName)}${a.worstTied.length ? ' <span style="color:var(--ember-400);font-size:.65rem">TIE</span>' : ""}</b>
                <small>${a.worst.winPct.toFixed(1)}% · ${a.worst.wins}W / ${a.worst.mp}</small></div></a>`
                : `<div class="history-pill none"><span class="icon" style="opacity:.4">💀</span><small style="color:var(--faint)">${
                    a.allTied ? "Dead tie — no 3aknofy" : "Not enough qualifiers"
                  }</small></div>`
            }
          </div></div>`;
            })
            .join("")
        : `<div class="glass empty-state"><span class="icon">🏟️</span><h3>No finished months yet</h3><p>This is the first season — history builds itself as months pass.</p></div>`
    }
  </div>`;
}

function pageH2H(data, params) {
  const byId = new Map(data.players.map((p) => [p.id, p]));
  const aId = Number(params.get("a")) || null;
  const bId = Number(params.get("b")) || null;
  const pa = aId ? byId.get(aId) : null;
  const pb = bId ? byId.get(bId) : null;
  const opts = (sel) =>
    data.players
      .map(
        (p) =>
          `<option value="${p.id}" ${String(p.id) === sel ? "selected" : ""}>${esc(
            displayName(p)
          )}</option>`
      )
      .join("");

  const picker = `<div class="glass filters" style="grid-template-columns:1fr 1fr;max-width:640px">
    <div class="field"><label for="h2hA">Player A</label><select id="h2hA"><option value="">— select —</option>${opts(
      aId ? String(aId) : ""
    )}</select></div>
    <div class="field"><label for="h2hB">Player B</label><select id="h2hB"><option value="">— select —</option>${opts(
      bId ? String(bId) : ""
    )}</select></div>
  </div>`;

  const body =
    pa && pb && pa.id !== pb.id
      ? (() => {
          const h = headToHead(data.matches, pa.id, pb.id);
          const duel = h.currentDuel
            ? `🔥 ${esc(displayName(byId.get(h.currentDuel.winnerId)))} won the last ${
                h.currentDuel.count >= 2 ? h.currentDuel.count + " meetings" : "meeting"
              } in a row · longest runs: ${esc(displayName(pa))} ${h.longestAStreak}W · ${esc(
                displayName(pb)
              )} ${h.longestBStreak}W`
            : null;
          const fmtCards = Object.keys(TYPE_LABELS)
            .map((t) => {
              const s = h.byFormat[t];
              return `<div class="fmt-card ${t.includes("multiplayer") ? "team" : "solo"}">
                <small>${TYPE_LABELS[t]}</small>
                <b>${s ? s.a + "–" + s.b : "–"}</b>
                <p>${s ? "wins: " + esc(displayName(pa)) + " first" : "never played"}</p>
              </div>`;
            })
            .join("");
          const list = h.meetings.length
            ? `<div class="match-list">${h.meetings
                .map((m) => matchCardHTML(m, data.players))
                .join("")}</div>`
            : `<div class="glass empty-state"><span class="icon">⚔️</span><h3>No meetings yet</h3><p>A rivalry waiting to happen.</p></div>`;
          return `<section class="glass" style="padding:28px;border-radius:22px">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:16px">
              <a href="#/players/${pa.id}" style="display:flex;align-items:center;gap:14px;min-width:0">
                ${avatar(pa, "lg ring")}
                <div><b style="font-family:var(--font-display);font-size:1.15rem">${esc(displayName(pa))}</b>
                <p class="award-pct" style="color:var(--volt-300)">${h.aWins}</p>
                <small style="color:var(--faint)">wins</small></div>
              </a>
              <div style="text-align:center">
                <p style="font-family:var(--font-display);font-size:1.6rem;color:rgba(255,255,255,.25);margin:0">VS</p>
                <small style="color:var(--muted)">${h.meetings.length} meetings</small>
              </div>
              <a href="#/players/${pb.id}" style="display:flex;align-items:center;gap:14px;min-width:0;flex-direction:row-reverse;text-align:right">
                ${avatar(pb, "lg")}
                <div><b style="font-family:var(--font-display);font-size:1.15rem">${esc(displayName(pb))}</b>
                <p class="award-pct" style="color:var(--ice-300)">${h.bWins}</p>
                <small style="color:var(--faint)">wins</small></div>
              </a>
            </div>
            ${duel ? `<p style="margin:18px 0 0;padding-top:16px;border-top:1px solid rgba(255,255,255,.1);text-align:center;font-size:.85rem;color:rgba(255,255,255,.7)">${duel}</p>` : ""}
          </section>
          <div class="fmt-grid" style="margin-top:22px">${fmtCards}</div>
          <h2 class="section-title" style="margin:34px 0 16px">Their meetings <span style="color:var(--faint)">· newest first</span></h2>
          ${list}`;
        })()
      : `<div class="glass empty-state" style="margin-top:22px"><span class="icon">⚔️</span><h3>Pick two players</h3><p>Their all-time rivalry record shows up here.</p></div>`;

  return `<div class="wrap page">
    <div class="page-head">
      <p class="eyebrow">Settle it on the screen</p>
      <h1>Head-to-head</h1>
      <p>All-time records between any two players — every meeting, every format, streaks included.</p>
    </div>
    ${picker}
    ${body}
  </div>`;
}

function pageNotFound() {
  return `<div class="wrap page"><div class="glass empty-state"><span class="icon">🤷</span>
    <h3>Page not found</h3><p><a href="#/" style="color:var(--volt-300)">Back to the dashboard</a></p></div></div>`;
}

function errorHTML(err) {
  return `<div class="wrap page"><div class="glass error-state">
    <span style="font-size:34px">📡</span>
    <h2 style="font-family:var(--font-display)">Can't reach the league sheet</h2>
    <p style="color:var(--muted);font-size:.88rem">${esc(err.message || String(err))}</p>
    <p style="color:var(--muted);font-size:.8rem">The site reads live data from the squad's Google Sheet. Make sure it's still shared as "Anyone with the link".</p>
    <button class="btn btn-primary" onclick="location.reload()">Retry</button>
    <a class="btn btn-ghost" href="${SHEET_URL}" target="_blank" rel="noopener">Open the sheet</a>
  </div></div>`;
}

/* ---------------- matches page state ---------------- */
const matchFilters = { player: "", type: "", month: "", winner: "" };

function applyMatchFilters(data) {
  const byId = new Map(data.players.map((p) => [p.id, p]));
  const list = data.matches.filter((m) => {
    if (matchFilters.type && m.type !== matchFilters.type) return false;
    if (matchFilters.month && monthKey(m.date) !== matchFilters.month) return false;
    if (matchFilters.player) {
      const id = Number(matchFilters.player);
      if (!m.A.includes(id) && !m.B.includes(id)) return false;
    }
    if (matchFilters.winner) {
      const id = Number(matchFilters.winner);
      const side = m.A.includes(id) ? "A" : m.B.includes(id) ? "B" : null;
      if (side !== m.winner) return false;
    }
    return true;
  });
  const countEl = document.getElementById("matchCount");
  const listEl = document.getElementById("matchList");
  if (!listEl) return;
  countEl.textContent = `${list.length} match${list.length === 1 ? "" : "es"}`;
  listEl.innerHTML = list.map((m) => matchCardHTML(m, data.players)).join("");
}

/* ---------------- router ---------------- */

let LEAGUE = null;

async function render() {
  const raw = location.hash || "#/";
  const route = raw.split("?")[0];
  const params = new URLSearchParams(raw.split("?")[1] || "");
  document.getElementById("nav").innerHTML = navHTML(route === "" ? "#/" : route);
  document.getElementById("navMobile").innerHTML = navHTML(route === "" ? "#/" : route);
  const app = document.getElementById("app");

  if (!LEAGUE) {
    app.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading live data from the league sheet…</p></div>`;
    try {
      LEAGUE = await loadLeague();
      document.getElementById("dataStamp").textContent =
        (LEAGUE.from === "snapshot" ? "published " : "sheet updated ") +
        LEAGUE.fetchedAt.toLocaleString();
    } catch (err) {
      app.innerHTML = errorHTML(err);
      return;
    }
  }

  const [base, param] = route.split("/").length > 2 ? [route.split("/").slice(0, 2).join("/"), route.split("/")[2]] : [route, null];
  let html = "";
  if (route === "#/" || route === "") html = pageDashboard(LEAGUE);
  else if (route === "#/standings") html = pageStandings(LEAGUE, standingsSort.key, standingsSort.asc);
  else if (route === "#/players") html = pagePlayers(LEAGUE);
  else if (base === "#/players" && param) html = pageProfile(LEAGUE, Number(param));
  else if (route === "#/matches") html = pageMatches(LEAGUE);
  else if (route === "#/h2h") html = pageH2H(LEAGUE, params);
  else if (route === "#/awards") html = pageAwards(LEAGUE);
  else html = pageNotFound();

  app.innerHTML = `<div class="fadespace">${html}</div>`;
  window.scrollTo(0, 0);

  if (route === "#/standings") {
    document.querySelectorAll("th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (standingsSort.key === key) standingsSort.asc = !standingsSort.asc;
        else {
          standingsSort.key = key;
          standingsSort.asc = key === "rank" || key === "losses" || key === "name";
        }
        render();
      });
    });
  }
  if (route === "#/matches") {
    const bind = (id, key) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("change", () => {
        matchFilters[key] = el.value;
        applyMatchFilters(LEAGUE);
      });
    };
    bind("fPlayer", "player");
    bind("fType", "type");
    bind("fMonth", "month");
    bind("fWinner", "winner");
    document.getElementById("fReset").addEventListener("click", () => {
      matchFilters.player = matchFilters.type = matchFilters.month = matchFilters.winner = "";
      render();
    });
    applyMatchFilters(LEAGUE);
  }
}

const standingsSort = { key: "rank", asc: true };

window.addEventListener("hashchange", render);
document.getElementById("navToggle").addEventListener("click", () => {
  const m = document.getElementById("navMobile");
  const open = m.hidden;
  m.hidden = !open;
  document.getElementById("navToggle").setAttribute("aria-expanded", String(open));
});
document.getElementById("navMobile").addEventListener("click", (e) => {
  if (e.target.tagName === "A") document.getElementById("navMobile").hidden = true;
});

render();
setInterval(() => {
  LEAGUE = null;
}, 10 * 60 * 1000); // re-pull the sheet every 10 minutes on next navigation
