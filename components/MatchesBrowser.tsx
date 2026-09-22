"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import MatchCard from "./MatchCard";
import type { MatchView } from "@/lib/view";
import type { Player } from "@/lib/types";
import { seasonMonthOptions } from "@/lib/season";

export default function MatchesBrowser({
  matches,
  players,
  isAdmin,
}: {
  matches: MatchView[];
  players: Player[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState("");
  const [type, setType] = useState("");
  const [month, setMonth] = useState("");
  const [winnerId, setWinnerId] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const months = useMemo(() => seasonMonthOptions(), []);

  const filtered = useMemo(() => {
    return matches.filter((m) => {
      if (type && m.type !== type) return false;
      if (month && !m.playedAt.startsWith(month)) return false;
      if (playerId) {
        const id = Number(playerId);
        if (!m.teams.some((t) => t.players.some((p) => p.id === id))) return false;
      }
      if (winnerId) {
        const id = Number(winnerId);
        if (!m.teams.some((t) => t.won && t.players.some((p) => p.id === id))) return false;
      }
      return true;
    });
  }, [matches, playerId, type, month, winnerId]);

  const remove = async (id: number) => {
    if (confirmId !== id) {
      setConfirmId(id);
      setTimeout(() => setConfirmId((c) => (c === id ? null : c)), 4000);
      return;
    }
    setBusyId(id);
    setConfirmId(null);
    try {
      await fetch(`/api/matches/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const reset = () => {
    setPlayerId("");
    setType("");
    setMonth("");
    setWinnerId("");
  };

  return (
    <div>
      <div className="glass mb-8 grid gap-3 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="label" htmlFor="f-player">Player</label>
          <select id="f-player" className="field" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value="">All players</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nickname || p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-type">Match type</label>
          <select id="f-type" className="field" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            <option value="single">Single Match</option>
            <option value="best_of_3">Best of 3</option>
            <option value="multiplayer">Multiplayer</option>
            <option value="multiplayer_best_of_3">Multiplayer Best of 3</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-month">Month</label>
          <select id="f-month" className="field" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">All season</option>
            {months.map((mo) => (
              <option key={mo.value} value={mo.value}>
                {mo.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-winner">Winner</label>
          <select id="f-winner" className="field" value={winnerId} onChange={(e) => setWinnerId(e.target.value)}>
            <option value="">Any winner</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nickname || p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button onClick={reset} className="btn btn-ghost w-full !py-2.5">
            Reset filters
          </button>
        </div>
      </div>

      <p className="mb-4 text-sm text-white/45">
        {filtered.length} match{filtered.length === 1 ? "" : "es"}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((m) => (
          <div key={m.id} className="relative">
            <MatchCard match={m} />
            {isAdmin && (
              <div className="absolute right-3 top-3 flex gap-2">
                <Link
                  href={`/record?edit=${m.id}`}
                  className="btn btn-ghost !px-2.5 !py-1 !text-[0.68rem]"
                >
                  Edit
                </Link>
                <button
                  onClick={() => remove(m.id)}
                  disabled={busyId === m.id}
                  className={`btn !px-2.5 !py-1 !text-[0.68rem] ${
                    confirmId === m.id ? "btn-danger animate-pulse" : "btn-ghost"
                  }`}
                >
                  {busyId === m.id ? "…" : confirmId === m.id ? "Sure?" : "Delete"}
                </button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="glass rounded-2xl p-6 text-sm text-white/50">
            No matches match these filters.
          </p>
        )}
      </div>
    </div>
  );
}
