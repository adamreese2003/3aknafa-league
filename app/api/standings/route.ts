import { NextResponse } from "next/server";
import { loadLeague } from "@/lib/league";

export async function GET() {
  const league = loadLeague();
  const rows = league.standings.map((s) => ({
    ...s,
    player: league.playerById.get(s.playerId) ?? null,
  }));
  return NextResponse.json({ standings: rows, settings: league.settings });
}
