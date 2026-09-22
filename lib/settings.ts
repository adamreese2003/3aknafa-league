import { getDb, runInTx } from "./db";
import type { LeagueSettings } from "./types";

export { pointsForType } from "./points";

export const DEFAULT_SETTINGS: LeagueSettings = {
  leagueName: "3AKNAFA LEAGUE",
  pointsSingle: 1,
  pointsBestOf3: 2,
  pointsMultiplayer: 1,
  pointsMultiplayerBo3: 2,
  minMonthlyMatches: 5,
  monthlyAwardsEnabled: true,
};

export function getSettings(): LeagueSettings {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM league_settings").all() as {
    key: string;
    value: string;
  }[];
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    leagueName: map.get("leagueName") ?? DEFAULT_SETTINGS.leagueName,
    pointsSingle: Number(map.get("pointsSingle") ?? DEFAULT_SETTINGS.pointsSingle),
    pointsBestOf3: Number(map.get("pointsBestOf3") ?? DEFAULT_SETTINGS.pointsBestOf3),
    pointsMultiplayer: Number(map.get("pointsMultiplayer") ?? DEFAULT_SETTINGS.pointsMultiplayer),
    pointsMultiplayerBo3: Number(
      map.get("pointsMultiplayerBo3") ?? DEFAULT_SETTINGS.pointsMultiplayerBo3
    ),
    minMonthlyMatches: Number(map.get("minMonthlyMatches") ?? DEFAULT_SETTINGS.minMonthlyMatches),
    monthlyAwardsEnabled:
      (map.get("monthlyAwardsEnabled") ?? String(DEFAULT_SETTINGS.monthlyAwardsEnabled)) === "true",
  };
}

export function saveSettings(patch: Partial<LeagueSettings>): LeagueSettings {
  const db = getDb();
  const current = getSettings();
  const next: LeagueSettings = { ...current, ...patch };
  const entries: [string, string][] = [
    ["leagueName", next.leagueName],
    ["pointsSingle", String(next.pointsSingle)],
    ["pointsBestOf3", String(next.pointsBestOf3)],
    ["pointsMultiplayer", String(next.pointsMultiplayer)],
    ["pointsMultiplayerBo3", String(next.pointsMultiplayerBo3)],
    ["minMonthlyMatches", String(next.minMonthlyMatches)],
    ["monthlyAwardsEnabled", String(next.monthlyAwardsEnabled)],
  ];
  const upsert = db.prepare(
    "INSERT INTO league_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  runInTx(db, () => {
    for (const [key, value] of entries) upsert.run(key, value);
  });
  return next;
}
