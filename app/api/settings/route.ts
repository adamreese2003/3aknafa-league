import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getSettings, saveSettings } from "@/lib/settings";

const patchSchema = z.object({
  leagueName: z.string().trim().min(1).max(60).optional(),
  pointsSingle: z.number().int().min(0).max(100).optional(),
  pointsBestOf3: z.number().int().min(0).max(100).optional(),
  pointsMultiplayer: z.number().int().min(0).max(100).optional(),
  pointsMultiplayerBo3: z.number().int().min(0).max(100).optional(),
  minMonthlyMatches: z.number().int().min(1).max(100).optional(),
  monthlyAwardsEnabled: z.boolean().optional(),
});

export async function GET() {
  return NextResponse.json({ settings: getSettings() });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid settings." },
      { status: 400 }
    );
  }
  return NextResponse.json({ settings: saveSettings(parsed.data) });
}
