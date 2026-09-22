import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // Native SQLite driver must stay outside the bundle.
  serverExternalPackages: ["better-sqlite3"],
  // The parent folder holds an unrelated lockfile; keep Turbopack scoped here.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
};

export default nextConfig;
