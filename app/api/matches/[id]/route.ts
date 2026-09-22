import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ValidationError, deleteMatch, getMatch, matchInputSchema, updateMatch } from "@/lib/matches";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const match = getMatch(Number(id));
  if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  return NextResponse.json({ match });
}

export async function PATCH(request: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = matchInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid match data." },
      { status: 400 }
    );
  }
  try {
    const match = updateMatch(Number(id), parsed.data);
    if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });
    return NextResponse.json({ match });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not update match." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ ok: deleteMatch(Number(id)) });
}
