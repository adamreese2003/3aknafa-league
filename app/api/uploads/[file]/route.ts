import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  // Reject anything that is not a simple, whitelisted image filename.
  if (!/^[a-f0-9]{24}\.(jpg|png|webp|avif)$/.test(file)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const full = path.join(process.cwd(), "data", "uploads", file);
  if (!fs.existsSync(full)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const ext = path.extname(file).toLowerCase();
  return new NextResponse(fs.readFileSync(full), {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
