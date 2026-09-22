import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createPlayer, getAllPlayers, playerInputSchema } from "@/lib/players";

export async function GET() {
  return NextResponse.json({ players: getAllPlayers() });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = playerInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid player data." },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json({ player: createPlayer(parsed.data) }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create player." },
      { status: 400 }
    );
  }
}
