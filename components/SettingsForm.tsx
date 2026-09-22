"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LeagueSettings } from "@/lib/types";

export default function SettingsForm({
  initialSettings,
  username,
}: {
  initialSettings: LeagueSettings;
  username: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<LeagueSettings>(initialSettings);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwNotice, setPwNotice] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  const num = (key: keyof LeagueSettings) => ({
    value: String(form[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Math.max(0, Math.min(100, Number(e.target.value)));
      setForm((f) => ({ ...f, [key]: v }));
    },
  });

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setNotice("Settings saved — everything recalculated.");
      router.refresh();
      setTimeout(() => setNotice(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const changePw = async () => {
    setPwError(null);
    setPwNotice(null);
    if (pw.next.length < 6) {
      setPwError("New password must be at least 6 characters.");
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwError("New passwords don’t match.");
      return;
    }
    try {
      // Verify current password by attempting a login.
      const check = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: pw.current }),
      });
      if (!check.ok) {
        setPwError("Current password is incorrect.");
        return;
      }
      const res = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: pw.next }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Could not change password.");
      }
      setPw({ current: "", next: "", confirm: "" });
      setPwNotice("Password updated.");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Could not change password.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="glass rounded-2xl p-6 sm:p-8">
        <h2 className="section-title mb-6">League rules</h2>

        {notice && (
          <p className="mb-4 rounded-xl border border-volt-400/30 bg-volt-400/10 px-4 py-2.5 text-sm text-volt-300">
            {notice}
          </p>
        )}
        {error && (
          <p className="mb-4 rounded-xl border border-ember-400/30 bg-ember-400/10 px-4 py-2.5 text-sm text-ember-400">
            {error}
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="s-name">League name</label>
            <input
              id="s-name"
              className="field"
              value={form.leagueName}
              onChange={(e) => setForm((f) => ({ ...f, leagueName: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="s-p1">Single match — win points</label>
            <input id="s-p1" type="number" min={0} max={100} className="field" {...num("pointsSingle")} />
          </div>
          <div>
            <label className="label" htmlFor="s-p2">Best of 3 — series win points</label>
            <input id="s-p2" type="number" min={0} max={100} className="field" {...num("pointsBestOf3")} />
          </div>
          <div>
            <label className="label" htmlFor="s-p3">Multiplayer — win points (per player)</label>
            <input id="s-p3" type="number" min={0} max={100} className="field" {...num("pointsMultiplayer")} />
          </div>
          <div>
            <label className="label" htmlFor="s-p4">Multiplayer Bo3 — win points (per player)</label>
            <input id="s-p4" type="number" min={0} max={100} className="field" {...num("pointsMultiplayerBo3")} />
          </div>
          <div>
            <label className="label" htmlFor="s-min">Minimum monthly matches (award qualification)</label>
            <input
              id="s-min"
              type="number"
              min={1}
              max={100}
              className="field"
              value={form.minMonthlyMatches}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  minMonthlyMatches: Math.max(1, Math.min(100, Number(e.target.value))),
                }))
              }
            />
          </div>
          <label className="flex items-center gap-3 self-end text-sm text-white/75">
            <input
              type="checkbox"
              className="size-4 accent-volt-400"
              checked={form.monthlyAwardsEnabled}
              onChange={(e) => setForm((f) => ({ ...f, monthlyAwardsEnabled: e.target.checked }))}
            />
            Monthly awards enabled
          </label>
        </div>

        <button onClick={save} disabled={busy} className="btn btn-primary mt-6">
          {busy ? "Saving…" : "Save settings"}
        </button>
      </section>

      <section className="glass rounded-2xl p-6 sm:p-8">
        <h2 className="section-title mb-2">Change admin password</h2>
        <p className="mb-6 text-sm text-white/45">Signed in as <span className="font-semibold text-white/70">{username}</span></p>

        {pwNotice && (
          <p className="mb-4 rounded-xl border border-volt-400/30 bg-volt-400/10 px-4 py-2.5 text-sm text-volt-300">
            {pwNotice}
          </p>
        )}
        {pwError && (
          <p className="mb-4 rounded-xl border border-ember-400/30 bg-ember-400/10 px-4 py-2.5 text-sm text-ember-400">
            {pwError}
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="pw-cur">Current password</label>
            <input
              id="pw-cur"
              type="password"
              className="field"
              autoComplete="current-password"
              value={pw.current}
              onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="pw-new">New password</label>
            <input
              id="pw-new"
              type="password"
              className="field"
              autoComplete="new-password"
              value={pw.next}
              onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="pw-conf">Confirm new password</label>
            <input
              id="pw-conf"
              type="password"
              className="field"
              autoComplete="new-password"
              value={pw.confirm}
              onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
            />
          </div>
        </div>
        <button
          onClick={changePw}
          disabled={!pw.current || !pw.next || !pw.confirm}
          className="btn btn-ghost mt-6"
        >
          Update password
        </button>
      </section>
    </div>
  );
}
