"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import PlayerAvatar from "./PlayerAvatar";
import type { MatchRecord, MatchType, Player, Side } from "@/lib/types";
import { MATCH_TYPE_LABELS } from "@/lib/types";

type Draft = {
  type: MatchType | null;
  sideA: number[];
  sideB: number[];
  winnerSide: Side | null;
  games: Side[];
  playedAt: string;
  location: string;
  gameTitle: string;
  notes: string;
  screenshotUrl: string;
};

function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function draftFromMatch(m: MatchRecord): Draft {
  return {
    type: m.type,
    sideA: m.participants.filter((p) => p.side === "A").map((p) => p.playerId),
    sideB: m.participants.filter((p) => p.side === "B").map((p) => p.playerId),
    winnerSide: m.winnerSide,
    games: m.games,
    playedAt: m.playedAt,
    location: m.location ?? "",
    gameTitle: m.gameTitle ?? "",
    notes: m.notes ?? "",
    screenshotUrl: m.screenshotUrl ?? "",
  };
}

const emptyDraft = (): Draft => ({
  type: null,
  sideA: [],
  sideB: [],
  winnerSide: null,
  games: [],
  playedAt: todayStr(),
  location: "",
  gameTitle: "EA FC 26",
  notes: "",
  screenshotUrl: "",
});

const TYPE_OPTIONS: { type: MatchType; blurb: string; icon: string }[] = [
  { type: "single", blurb: "One player vs one player", icon: "🎮" },
  { type: "best_of_3", blurb: "1v1 series · first to 2 wins", icon: "🏆" },
  { type: "multiplayer", blurb: "Teams · 2v2 or bigger", icon: "👥" },
  { type: "multiplayer_best_of_3", blurb: "Team series · first to 2 wins", icon: "⚔️" },
];

export default function RecordMatchWizard({
  players,
  editMatch,
  pointsConfig,
}: {
  players: Player[];
  editMatch: MatchRecord | null;
  pointsConfig: Record<MatchType, number>;
}) {
  const router = useRouter();
  const [step, setStep] = useState(editMatch ? 2 : 1);
  const [draft, setDraft] = useState<Draft>(() => editMatch ? draftFromMatch(editMatch) : emptyDraft());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isBo3 = draft.type === "best_of_3" || draft.type === "multiplayer_best_of_3";
  const is1v1 = draft.type === "single" || draft.type === "best_of_3";
  const activePlayers = useMemo(() => players.filter((p) => p.active), [players]);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const name = (id: number) => {
    const p = byId.get(id);
    return p ? p.nickname || p.name : `#${id}`;
  };

  const seriesScore = (side: Side) => draft.games.filter((g) => g === side).length;
  const seriesDone = seriesScore("A") === 2 || seriesScore("B") === 2;
  const derivedWinner: Side | null = isBo3
    ? seriesScore("A") === 2
      ? "A"
      : seriesScore("B") === 2
        ? "B"
        : null
    : draft.winnerSide;

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  // ---- step validation ----
  const stepError = (): string | null => {
    if (step === 1 && !draft.type) return "Pick a match type first.";
    if (step === 2) {
      if (draft.sideA.length === 0 || draft.sideB.length === 0)
        return "Both teams need at least one player.";
      if (draft.sideA.some((id) => draft.sideB.includes(id)))
        return "A player can’t be on both teams.";
      if (is1v1 && (draft.sideA.length > 1 || draft.sideB.length > 1))
        return "This format is strictly 1v1.";
      if (!is1v1 && draft.sideA.length === 1 && draft.sideB.length === 1)
        return "For 1v1 use Single Match or Best of 3.";
    }
    if (step === 3) {
      if (isBo3 && !seriesDone) return "The series isn’t decided yet — someone needs 2 wins.";
      if (!isBo3 && !draft.winnerSide) return "Pick the winning team.";
    }
    if (step === 4 && !draft.playedAt) return "Pick the match date.";
    return null;
  };

  const next = () => {
    const err = stepError();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(4, s + 1));
  };
  const back = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  // ---- team picking ----
  const pick1v1 = (side: Side, playerId: string) => {
    const id = playerId ? Number(playerId) : null;
    if (id === null) {
      patch(side === "A" ? { sideA: [] } : { sideB: [] });
      return;
    }
    // Switching sides of an already-picked player swaps him.
    const other = side === "A" ? draft.sideB : draft.sideA;
    if (other.includes(id)) {
      const prevSelf = side === "A" ? draft.sideA[0] : draft.sideB[0];
      patch(
        side === "A"
          ? { sideA: [id], sideB: prevSelf ? [prevSelf] : [] }
          : { sideB: [id], sideA: prevSelf ? [prevSelf] : [] }
      );
      return;
    }
    patch(side === "A" ? { sideA: [id] } : { sideB: [id] });
  };

  const addToTeam = (side: Side, id: number) => {
    patch(
      side === "A"
        ? { sideA: [...draft.sideA.filter((x) => x !== id), id] }
        : { sideB: [...draft.sideB.filter((x) => x !== id), id] }
    );
  };
  const removeFromTeam = (side: Side, id: number) => {
    patch(
      side === "A"
        ? { sideA: draft.sideA.filter((x) => x !== id) }
        : { sideB: draft.sideB.filter((x) => x !== id) }
    );
  };

  // ---- Bo3 games ----
  const setGameWinner = (index: number, side: Side) => {
    setDraft((d) => {
      const games = d.games.slice(0, index);
      games[index] = side;
      const a = games.filter((g) => g === "A").length;
      const b = games.length - a;
      const winner: Side | null = a === 2 ? "A" : b === 2 ? "B" : null;
      return { ...d, games, winnerSide: winner };
    });
  };
  const undoGame = () => setDraft((d) => ({ ...d, games: d.games.slice(0, -1) }));

  // ---- submit ----
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        type: draft.type,
        playedAt: draft.playedAt,
        participants: [
          ...draft.sideA.map((playerId) => ({ playerId, side: "A" as const })),
          ...draft.sideB.map((playerId) => ({ playerId, side: "B" as const })),
        ],
        games: isBo3 ? draft.games : [],
        winnerSide: derivedWinner ?? undefined,
        location: draft.location || null,
        gameTitle: draft.gameTitle || null,
        notes: draft.notes || null,
        screenshotUrl: draft.screenshotUrl || null,
      };
      const res = await fetch(editMatch ? `/api/matches/${editMatch.id}` : "/api/matches", {
        method: editMatch ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save the match.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the match.");
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      patch({ screenshotUrl: data.url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <div className="glass mx-auto max-w-xl rounded-3xl p-8 text-center sm:p-12">
        <p className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-volt-400/15 text-3xl">✅</p>
        <h2 className="heading-display text-2xl text-white sm:text-3xl">Match saved</h2>
        <p className="mt-2 text-sm text-white/55">
          Standings, points, win rates and monthly awards were recalculated automatically.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              setDraft(emptyDraft());
              setSaved(false);
              setStep(1);
            }}
            className="btn btn-primary"
          >
            Record another
          </button>
          <Link href="/standings" className="btn btn-ghost">Standings</Link>
          <Link href="/matches" className="btn btn-ghost">History</Link>
        </div>
      </div>
    );
  }

  const winnerTeam = derivedWinner === "A" ? draft.sideA : draft.sideB;
  const loserTeam = derivedWinner === "A" ? draft.sideB : draft.sideA;
  const pts = draft.type ? pointsConfig[draft.type] : 0;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Stepper */}
      <ol className="mb-8 flex items-center gap-2">
        {["Format", "Players", "Result", "Details"].map((label, i) => {
          const n = i + 1;
          const state = step === n ? "current" : step > n ? "done" : "todo";
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full font-display text-sm font-bold transition-colors duration-300 ${
                  state === "current"
                    ? "bg-volt-400 text-pitch-950"
                    : state === "done"
                      ? "bg-volt-400/20 text-volt-300"
                      : "bg-white/8 text-white/40"
                }`}
              >
                {state === "done" ? "✓" : n}
              </span>
              <span
                className={`hidden text-xs font-semibold tracking-wide sm:block ${
                  state === "todo" ? "text-white/35" : "text-white/75"
                }`}
              >
                {label}
              </span>
              {n < 4 && <span className="h-px flex-1 bg-white/10" />}
            </li>
          );
        })}
      </ol>

      {error && (
        <p className="mb-5 rounded-xl border border-ember-400/30 bg-ember-400/10 px-4 py-3 text-sm text-ember-400">
          {error}
        </p>
      )}

      {/* Step 1 — type */}
      {step === 1 && (
        <section>
          <h2 className="section-title mb-1">What did you play?</h2>
          <p className="mb-6 text-sm text-white/50">Pick the format — points are awarded per the league rules.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                onClick={() => patch({ type: opt.type })}
                className={`glass glass-hover rounded-2xl p-5 text-left ${
                  draft.type === opt.type ? "!border-volt-400/60 bg-volt-400/10" : ""
                }`}
              >
                <span className="text-2xl">{opt.icon}</span>
                <p className="mt-2 font-display text-lg font-bold text-white">
                  {MATCH_TYPE_LABELS[opt.type]}
                </p>
                <p className="mt-0.5 text-xs text-white/50">{opt.blurb}</p>
                <p className="mt-2 text-xs font-bold tracking-wider text-volt-300">
                  WIN = +{pointsConfig[opt.type]} PTS{!opt.type.includes("single") && !opt.type.includes("best") ? " EACH" : ""}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Step 2 — players */}
      {step === 2 && (
        <section>
          <h2 className="section-title mb-1">Who played?</h2>
          <p className="mb-6 text-sm text-white/50">
            {is1v1 ? "One player per side." : "Stack each team — tap a player, then choose his side."}
          </p>

          {is1v1 ? (
            <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              {(["A", "B"] as Side[]).map((side, idx) => {
                const picked = (side === "A" ? draft.sideA : draft.sideB)[0];
                const other = (side === "A" ? draft.sideB : draft.sideA)[0];
                const player = picked ? byId.get(picked) : null;
                return (
                  <div key={side} className={idx === 1 ? "" : ""}>
                    <div
                      className={`glass rounded-2xl p-5 ${
                        idx === 1 ? "sm:order-3" : ""
                      }`}
                    >
                      <p className="label mb-3">Team {side}</p>
                      {player && (
                        <div className="mb-4 flex items-center gap-3">
                          <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size={56} ring />
                          <p className="font-display text-lg font-bold text-white">
                            {player.nickname || player.name}
                          </p>
                        </div>
                      )}
                      <select
                        className="field"
                        value={picked ?? ""}
                        onChange={(e) => pick1v1(side, e.target.value)}
                        aria-label={`Team ${side} player`}
                      >
                        <option value="">— select player —</option>
                        {activePlayers.map((p) => (
                          <option key={p.id} value={p.id} disabled={p.id === other}>
                            {p.nickname || p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
              <p className="hidden text-center font-display text-xl font-bold text-white/30 sm:order-2 sm:block">
                VS
              </p>
            </div>
          ) : (
            <div>
              <p className="label">Available players</p>
              <div className="mb-6 flex flex-wrap gap-2">
                {activePlayers.map((p) => {
                  const onA = draft.sideA.includes(p.id);
                  const onB = draft.sideB.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 rounded-full border px-2 py-1.5 pr-1.5 transition-colors duration-200 ${
                        onA || onB
                          ? "border-volt-400/50 bg-volt-400/10"
                          : "border-white/12 bg-white/[0.04]"
                      }`}
                    >
                      <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size={28} />
                      <span className="text-sm font-semibold text-white/85">
                        {p.nickname || p.name}
                      </span>
                      <span className="flex gap-1">
                        <button
                          onClick={() => addToTeam("A", p.id)}
                          disabled={onB}
                          className={`rounded-md px-2 py-0.5 font-display text-[0.65rem] font-bold transition-colors duration-200 ${
                            onA ? "bg-volt-400 text-pitch-950" : "bg-white/10 text-white/60 hover:bg-volt-400/30"
                          } disabled:opacity-25`}
                        >
                          A
                        </button>
                        <button
                          onClick={() => addToTeam("B", p.id)}
                          disabled={onA}
                          className={`rounded-md px-2 py-0.5 font-display text-[0.65rem] font-bold transition-colors duration-200 ${
                            onB ? "bg-ice-400 text-pitch-950" : "bg-white/10 text-white/60 hover:bg-ice-400/30"
                          } disabled:opacity-25`}
                        >
                          B
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {(["A", "B"] as Side[]).map((side) => {
                  const team = side === "A" ? draft.sideA : draft.sideB;
                  return (
                    <div
                      key={side}
                      className={`glass min-h-28 rounded-2xl p-4 ${
                        side === "A" ? "border-volt-400/25" : "border-ice-400/25"
                      }`}
                    >
                      <p className="label mb-3">
                        Team {side} · {team.length} player{team.length === 1 ? "" : "s"}
                      </p>
                      {team.length === 0 && <p className="text-xs text-white/35">Empty</p>}
                      <div className="flex flex-wrap gap-2">
                        {team.map((id) => (
                          <span
                            key={id}
                            className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] py-1 pl-1 pr-2"
                          >
                            <PlayerAvatar name={name(id)} photoUrl={byId.get(id)?.photoUrl ?? null} size={26} />
                            <span className="text-xs font-semibold text-white/85">{name(id)}</span>
                            <button
                              onClick={() => removeFromTeam(side, id)}
                              className="grid size-4 place-items-center rounded-full bg-white/10 text-[0.6rem] text-white/60 transition-colors hover:bg-ember-400 hover:text-white"
                              aria-label={`Remove ${name(id)}`}
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Step 3 — result */}
      {step === 3 && (
        <section>
          <h2 className="section-title mb-1">{isBo3 ? "Game by game" : "Who won?"}</h2>
          <p className="mb-6 text-sm text-white/50">
            {isBo3
              ? "Tap the winner of each game. The series ends when a side reaches 2 wins."
              : "One tap — the losing side gets nothing."}
          </p>

          {isBo3 ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => {
                const decided = i < draft.games.length;
                const playable = i === draft.games.length && !seriesDone;
                if (!decided && !playable) {
                  return (
                    <div
                      key={i}
                      className="glass rounded-2xl px-5 py-4 text-sm text-white/30"
                    >
                      Game {i + 1} — not played
                    </div>
                  );
                }
                return (
                  <div
                    key={i}
                    className={`glass rounded-2xl p-4 ${
                      playable ? "border-volt-400/30" : ""
                    } ${!playable && !decided ? "opacity-40" : ""}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-display text-sm font-bold tracking-wider text-white/60">
                        GAME {i + 1}
                      </p>
                      <div className="flex gap-2">
                        {(["A", "B"] as Side[]).map((side) => {
                          const label = (side === "A" ? draft.sideA : draft.sideB)
                            .map(name)
                            .join(" & ");
                          const won = draft.games[i] === side;
                          return (
                            <button
                              key={side}
                              disabled={!playable}
                              onClick={() => setGameWinner(i, side)}
                              className={`btn !py-2 !text-xs ${
                                won ? "btn-primary" : "btn-ghost"
                              } ${!playable && !won ? "opacity-50" : ""}`}
                            >
                              {label || `Team ${side}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between">
                <button onClick={undoGame} disabled={draft.games.length === 0} className="btn btn-ghost !py-2 !text-xs">
                  ← Undo game
                </button>
                {seriesDone && (
                  <p className="text-sm font-semibold text-volt-300">
                    Series: {draft.sideA.map(name).join(" & ")} {seriesScore("A")}–{seriesScore("B")}{" "}
                    {draft.sideB.map(name).join(" & ")} ·{" "}
                    {derivedWinner === "A"
                      ? draft.sideA.map(name).join(" & ")
                      : draft.sideB.map(name).join(" & ")}{" "}
                    takes it {is1v1 ? "" : "(every winner +2 pts)"} · +{pts} pts
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {(["A", "B"] as Side[]).map((side) => {
                const team = side === "A" ? draft.sideA : draft.sideB;
                const won = draft.winnerSide === side;
                return (
                  <button
                    key={side}
                    onClick={() => patch({ winnerSide: side })}
                    className={`glass glass-hover rounded-2xl p-6 text-left ${
                      won ? "!border-volt-400/60 bg-volt-400/10" : ""
                    }`}
                  >
                    <p className="label mb-3">Team {side} {won && "· WINNER 🏆"}</p>
                    <div className="flex flex-wrap gap-3">
                      {team.map((id) => (
                        <span key={id} className="flex items-center gap-2">
                          <PlayerAvatar
                            name={name(id)}
                            photoUrl={byId.get(id)?.photoUrl ?? null}
                            size={44}
                            ring={won}
                          />
                          <span className="text-sm font-semibold text-white">{name(id)}</span>
                        </span>
                      ))}
                    </div>
                    {won && (
                      <p className="mt-4 text-sm font-bold text-volt-300">
                        +{pts} point{pts === 1 ? "" : "s"} each
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Step 4 — details + confirm */}
      {step === 4 && (
        <section>
          <h2 className="section-title mb-1">Finish up</h2>
          <p className="mb-6 text-sm text-white/50">Date is required; everything else is optional.</p>

          <div className="glass mb-5 rounded-2xl p-5">
            <p className="label">Confirmation</p>
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
              <span className="badge border-ice-400/40 text-ice-300">
                {draft.type ? MATCH_TYPE_LABELS[draft.type] : ""}
              </span>
              <span className="font-semibold text-white">
                {draft.sideA.map(name).join(" & ")}
              </span>
              <span className="text-white/40">
                {isBo3 ? `${seriesScore("A")}–${seriesScore("B")}` : "vs"}
              </span>
              <span className="font-semibold text-white">
                {draft.sideB.map(name).join(" & ")}
              </span>
            </div>
            {winnerTeam.length > 0 && (
              <p className="mt-2 text-sm text-volt-300">
                🏆 {winnerTeam.map(name).join(" & ")} win{winnerTeam.length === 1 ? "s" : ""} ·{" "}
                +{pts} pt{pts === 1 ? "" : "s"} each · losers +0
                {loserTeam.length === 0 ? "" : ` (${loserTeam.map(name).join(" & ")})`}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="m-date">Date *</label>
              <input
                id="m-date"
                type="date"
                className="field"
                max={todayStr()}
                value={draft.playedAt}
                onChange={(e) => patch({ playedAt: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="m-loc">Location</label>
              <input
                id="m-loc"
                className="field"
                placeholder="The Den"
                value={draft.location}
                onChange={(e) => patch({ location: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="m-game">Game title</label>
              <input
                id="m-game"
                className="field"
                placeholder="EA FC 26"
                value={draft.gameTitle}
                onChange={(e) => patch({ gameTitle: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Screenshot (optional)</label>
              <div className="flex items-center gap-3">
                {draft.screenshotUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={draft.screenshotUrl}
                    alt="Screenshot"
                    className="h-12 rounded-lg object-cover ring-1 ring-white/20"
                  />
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn btn-ghost !px-3 !py-1.5 !text-xs"
                  disabled={busy}
                >
                  {busy ? "Uploading…" : "Upload"}
                </button>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="m-notes">Notes</label>
              <textarea
                id="m-notes"
                className="field min-h-20"
                placeholder="Banter worth remembering…"
                value={draft.notes}
                onChange={(e) => patch({ notes: e.target.value })}
              />
            </div>
          </div>
        </section>
      )}

      {/* Nav buttons */}
      <div className="mt-8 flex items-center justify-between gap-3">
        <button onClick={back} disabled={step === 1} className="btn btn-ghost">
          ← Back
        </button>
        {step < 4 ? (
          <button onClick={next} className="btn btn-primary">
            Next →
          </button>
        ) : (
          <button onClick={submit} disabled={busy} className="btn btn-primary">
            {busy ? "Saving…" : editMatch ? "Save changes" : "Confirm & save"}
          </button>
        )}
      </div>
    </div>
  );
}
