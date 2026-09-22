import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deactivatePlayer, getPlayerById, updatePlayer, playerInputSchema } from "@/lib/players";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const player = getPlayerById(Number(id));
  if (!player) return NextResponse.json({ error: "Player not found." }, { status: 404 });
  return NextResponse.json({ player });
}

export async function PATCH(request: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = playerInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid player data." },
      { status: 400 }
    );
  }
  try {
    const player = updatePlayer(Number(id), parsed.data);
    if (!player) return NextResponse.json({ error: "Player not found." }, { status: 404 });
    return NextResponse.json({ player });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update player." },
      { status: 400 }
    );
  }
}

/** DELETE deactivates the player — statistics and history are preserved. */
export async function DELETE(_request: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  const { id } = await params;
  const player = deactivatePlayer(Number(id));
  if (!player) return NextResponse.json({ error: "Player not found." }, { status: 404 });
  return NextResponse.json({ player });
}
