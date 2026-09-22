"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { SessionUser } from "@/lib/types";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/standings", label: "Standings" },
  { href: "/players", label: "Players" },
  { href: "/matches", label: "Matches" },
  { href: "/awards", label: "Awards" },
];

export default function Nav({
  leagueName,
  user,
}: {
  leagueName: string;
  user: SessionUser | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-pitch-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-3"
          onClick={() => setOpen(false)}
        >
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-volt-300 to-volt-600 font-display text-lg font-bold text-pitch-950 shadow-volt transition-transform duration-300 group-hover:rotate-6">
            ⚽
          </span>
          <span className="font-display text-sm font-bold tracking-tight text-white sm:text-base">
            {leagueName}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3.5 py-2 font-display text-sm font-semibold transition-colors duration-200 ${
                isActive(link.href)
                  ? "bg-white/8 text-volt-300"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {user?.role === "admin" && (
            <Link
              href="/record"
              className={`ml-1 rounded-lg px-3.5 py-2 font-display text-sm font-semibold transition-colors duration-200 ${
                isActive("/record")
                  ? "bg-white/8 text-volt-300"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              Record
            </Link>
          )}
          {user?.role === "admin" ? (
            <div className="ml-3 flex items-center gap-2 border-l border-white/10 pl-3">
              <Link
                href="/settings"
                className={`btn btn-ghost !px-3 !py-1.5 !text-xs ${
                  isActive("/settings") ? "!border-volt-400/50 text-volt-300" : ""
                }`}
              >
                Settings
              </Link>
              <button onClick={logout} className="btn btn-ghost !px-3 !py-1.5 !text-xs">
                Log out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="btn btn-primary ml-3 !px-4 !py-1.5 !text-xs"
            >
              Admin
            </Link>
          )}
        </nav>

        <button
          className="btn btn-ghost !px-3 !py-2 lg:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="border-t border-white/8 bg-pitch-950/95 px-4 pb-4 pt-2 backdrop-blur-xl lg:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2.5 font-display text-sm font-semibold ${
                  isActive(link.href)
                    ? "bg-white/8 text-volt-300"
                    : "text-white/70 hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {user?.role === "admin" && (
              <>
                <Link
                  href="/record"
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-3 py-2.5 font-display text-sm font-semibold ${
                    isActive("/record")
                      ? "bg-white/8 text-volt-300"
                      : "text-white/70 hover:bg-white/5"
                  }`}
                >
                  Record Match
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-3 py-2.5 font-display text-sm font-semibold ${
                    isActive("/settings")
                      ? "bg-white/8 text-volt-300"
                      : "text-white/70 hover:bg-white/5"
                  }`}
                >
                  Settings
                </Link>
                <button
                  onClick={logout}
                  className="rounded-lg px-3 py-2.5 text-left font-display text-sm font-semibold text-white/70 hover:bg-white/5"
                >
                  Log out
                </button>
              </>
            )}
            {!user && (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="btn btn-primary mt-2"
              >
                Admin login
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
