import { NextResponse } from "next/server";
import { z } from "zod";
import { changePassword, requireAdmin } from "@/lib/auth";

const schema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters.").max(100),
});

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid password." },
      { status: 400 }
    );
  }
  changePassword(admin.id, parsed.data.newPassword);
  return NextResponse.json({ ok: true });
}
