import type { LeagueSettings } from "./types";

/**
 * Pure points lookup — kept free of any database imports so client
 * components can safely use it (lib/settings pulls in lib/db).
 */
export function pointsForType(settings: LeagueSettings, type: string): number {
  switch (type) {
    case "single":
      return settings.pointsSingle;
    case "best_of_3":
      return settings.pointsBestOf3;
    case "multiplayer":
      return settings.pointsMultiplayer;
    case "multiplayer_best_of_3":
      return settings.pointsMultiplayerBo3;
    default:
      return 0;
  }
}
