"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed.");
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass rounded-3xl p-8 sm:p-10">
      <h1 className="heading-display text-2xl text-white sm:text-3xl">Admin login</h1>
      <p className="mt-1.5 text-sm text-white/50">
        Viewers don’t need an account — sign in to manage players and record matches.
      </p>

      {error && (
        <p className="mt-5 rounded-xl border border-ember-400/30 bg-ember-400/10 px-4 py-2.5 text-sm text-ember-400">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="login-user">Username</label>
          <input
            id="login-user"
            className="field"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
          />
        </div>
        <div>
          <label className="label" htmlFor="login-pass">Password</label>
          <input
            id="login-pass"
            type="password"
            className="field"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
      </div>

      <button type="submit" disabled={busy || !username || !password} className="btn btn-primary mt-6 w-full">
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
