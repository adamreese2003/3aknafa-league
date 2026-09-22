"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import PlayerAvatar from "./PlayerAvatar";

export interface StandingRow {
  rank: number;
  tied: boolean;
  playerId: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  points: number;
  winPct: number;
  player: { id: number; name: string; nickname: string | null; photoUrl: string | null; active: boolean };
}

type SortKey = "rank" | "matchesPlayed" | "wins" | "losses" | "points" | "winPct";

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "rank", label: "#" },
  { key: "matchesPlayed", label: "MP" },
  { key: "wins", label: "W" },
  { key: "losses", label: "L" },
  { key: "points", label: "Pts" },
  { key: "winPct", label: "Win %" },
];

export default function StandingsTable({ rows }: { rows: StandingRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [asc, setAsc] = useState(true);

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      const dir = asc ? 1 : -1;
      if (sortKey === "rank") return (a.rank - b.rank) * 1 || a.player.name.localeCompare(b.player.name);
      return (a[sortKey] - b[sortKey]) * dir || a.rank - b.rank;
    });
    return list;
  }, [rows, sortKey, asc]);

  const toggle = (key: SortKey) => {
    if (key === sortKey) {
      setAsc((v) => !v);
    } else {
      setSortKey(key);
      setAsc(key === "rank" || key === "losses" ? true : false); // sensible defaults
    }
  };

  if (rows.length === 0) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <p className="text-3xl">🏟️</p>
        <p className="mt-3 font-display font-bold text-white/80">The table is empty</p>
        <p className="mt-1 text-sm text-white/45">
          Record the first match and the standings build themselves.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="glass hidden overflow-hidden rounded-2xl md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03]">
              <th scope="col" className="px-3 py-3.5 pl-5 text-left">
                <button
                  onClick={() => toggle("rank")}
                  className={`font-display text-[0.68rem] font-bold tracking-[0.14em] transition-colors duration-200 hover:text-volt-300 ${
                    sortKey === "rank" ? "text-volt-300" : "text-white/45"
                  }`}
                >
                  #
                  {sortKey === "rank" && <span className="ml-1">{asc ? "▲" : "▼"}</span>}
                </button>
              </th>
              <th scope="col" className="px-3 py-3.5 text-left font-display text-[0.68rem] font-bold tracking-[0.14em] text-white/45">
                PLAYER
              </th>
              {COLUMNS.filter((c) => c.key !== "rank").map((col) => (
                <th key={col.key} scope="col" className="px-3 py-3.5 text-right last:pr-5">
                  <button
                    onClick={() => toggle(col.key)}
                    className={`w-full font-display text-[0.68rem] font-bold tracking-[0.14em] transition-colors duration-200 hover:text-volt-300 ${
                      sortKey === col.key ? "text-volt-300" : "text-white/45"
                    }`}
                    aria-label={`Sort by ${col.label}`}
                  >
                    {col.label}
                    {sortKey === col.key && <span className="ml-1">{asc ? "▲" : "▼"}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.playerId}
                className="group border-b border-white/5 transition-colors duration-200 last:border-0 hover:bg-white/[0.04]"
              >
                <td className="px-3 py-3 pl-5">
                  <span
                    className={`font-display text-base font-bold ${
                      row.rank === 1
                        ? "text-volt-300"
                        : row.rank === 2
                          ? "text-ice-300"
                          : row.rank === 3
                            ? "text-ember-400"
                            : "text-white/40"
                    }`}
                  >
                    {row.rank}
                    {row.tied && <span className="text-[0.6em] text-white/40"> =</span>}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <Link
                    href={`/players/${row.playerId}`}
                    className="flex items-center gap-3 transition-colors duration-200"
                  >
                    <PlayerAvatar
                      name={row.player.nickname || row.player.name}
                      photoUrl={row.player.photoUrl}
                      size={38}
                      ring={row.rank === 1}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-display font-semibold text-white group-hover:text-volt-300">
                        {row.player.nickname || row.player.name}
                      </span>
                      {!row.player.active && (
                        <span className="text-[0.65rem] uppercase tracking-wider text-white/30">
                          inactive
                        </span>
                      )}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-white/70">{row.matchesPlayed}</td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold text-volt-300">{row.wins}</td>
                <td className="px-3 py-3 text-right tabular-nums text-ember-400/90">{row.losses}</td>
                <td className="px-3 py-3 text-right font-display text-base font-bold tabular-nums text-white">
                  {row.points}
                </td>
                <td className="px-3 py-3 pr-5 text-right">
                  <div className="flex items-center justify-end gap-2.5">
                    <span className="tabular-nums text-white/80">{row.winPct.toFixed(1)}%</span>
                    <span className="h-1.5 w-14 overflow-hidden rounded-full bg-white/10">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-volt-500 to-volt-300"
                        style={{ width: `${Math.round(row.winPct)}%` }}
                      />
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {sorted.map((row) => (
          <Link
            key={row.playerId}
            href={`/players/${row.playerId}`}
            className="glass glass-hover flex items-center gap-3 rounded-2xl p-3.5"
          >
            <span
              className={`w-7 shrink-0 text-center font-display text-lg font-bold ${
                row.rank === 1
                  ? "text-volt-300"
                  : row.rank === 2
                    ? "text-ice-300"
                    : row.rank === 3
                      ? "text-ember-400"
                      : "text-white/40"
              }`}
            >
              {row.rank}
            </span>
            <PlayerAvatar
              name={row.player.nickname || row.player.name}
              photoUrl={row.player.photoUrl}
              size={42}
              ring={row.rank === 1}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display font-semibold text-white">
                {row.player.nickname || row.player.name}
              </p>
              <p className="text-xs text-white/45">
                {row.wins}W · {row.losses}L · {row.matchesPlayed} MP
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-lg font-bold text-volt-300">{row.points}</p>
              <p className="text-[0.65rem] text-white/40">{row.winPct.toFixed(1)}%</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
