"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Player } from "@/lib/types";

export default function H2HPicker({
  players,
  aId,
  bId,
}: {
  players: Player[];
  aId: number | null;
  bId: number | null;
}) {
  const router = useRouter();
  const [a, setA] = useState(aId ? String(aId) : "");
  const [b, setB] = useState(bId ? String(bId) : "");

  const go = (nextA: string, nextB: string) => {
    if (nextA && nextB && nextA !== nextB) router.push(`/h2h?a=${nextA}&b=${nextB}`);
  };

  const swapDisabled = !a || !b;

  return (
    <div className="glass grid gap-3 rounded-2xl p-4 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
      <div>
        <label className="label" htmlFor="h2h-a">Player A</label>
        <select
          id="h2h-a"
          className="field"
          value={a}
          onChange={(e) => {
            setA(e.target.value);
            go(e.target.value, b);
          }}
        >
          <option value="">— select —</option>
          {players.map((p) => (
            <option key={p.id} value={p.id} disabled={String(p.id) === b}>
              {p.nickname || p.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className="btn btn-ghost !px-3 !py-2.5 sm:mb-0.5"
        disabled={swapDisabled}
        aria-label="Swap players"
        onClick={() => {
          const nextA = b;
          const nextB = a;
          setA(nextA);
          setB(nextB);
          go(nextA, nextB);
        }}
      >
        ⇄
      </button>

      <div>
        <label className="label" htmlFor="h2h-b">Player B</label>
        <select
          id="h2h-b"
          className="field"
          value={b}
          onChange={(e) => {
            setB(e.target.value);
            go(a, e.target.value);
          }}
        >
          <option value="">— select —</option>
          {players.map((p) => (
            <option key={p.id} value={p.id} disabled={String(p.id) === a}>
              {p.nickname || p.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className="btn btn-ghost !py-2.5"
        disabled={swapDisabled}
        onClick={() => {
          setA("");
          setB("");
          router.push("/h2h");
        }}
      >
        Clear
      </button>
    </div>
  );
}
