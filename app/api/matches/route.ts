import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ValidationError, createMatch, getAllMatches, matchInputSchema } from "@/lib/matches";
import type { MatchType } from "@/lib/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const num = (key: string) => {
    const v = url.searchParams.get(key);
    return v ? Number(v) : undefined;
  };
  const type = url.searchParams.get("type") as MatchType | null;
  const matches = getAllMatches({
    playerId: num("playerId"),
    winnerId: num("winnerId"),
    type: type ?? undefined,
    month: url.searchParams.get("month") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    limit: num("limit"),
  });
  return NextResponse.json({ matches });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = matchInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid match data." },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json({ match: createMatch(parsed.data) }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not save match." }, { status: 500 });
  }
}
