"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import PlayerAvatar from "./PlayerAvatar";
import type { Player } from "@/lib/types";

interface FormState {
  name: string;
  nickname: string;
  club: string;
  photoUrl: string;
  active: boolean;
}

const emptyForm: FormState = { name: "", nickname: "", club: "", photoUrl: "", active: true };

export default function PlayersAdmin({ players }: { players: Player[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setOpen(true);
  };

  const openEdit = (p: Player) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      nickname: p.nickname ?? "",
      club: p.club ?? "",
      photoUrl: p.photoUrl ?? "",
      active: p.active,
    });
    setError(null);
    setOpen(true);
  };

  const uploadPhoto = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      setForm((f) => ({ ...f, photoUrl: data.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        nickname: form.nickname.trim() || null,
        club: form.club.trim() || null,
        photoUrl: form.photoUrl.trim() || null,
        active: form.active,
      };
      const res = await fetch(
        editingId ? `/api/players/${editingId}` : "/api/players",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setNotice(editingId ? "Player updated." : "Player added.");
      setEditingId(null);
      setForm(emptyForm);
      router.refresh();
      setTimeout(() => setNotice(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (p: Player) => {
    if (confirmId !== p.id) {
      setConfirmId(p.id);
      setTimeout(() => setConfirmId((c) => (c === p.id ? null : c)), 4000);
      return;
    }
    setConfirmId(null);
    setBusy(true);
    try {
      await fetch(`/api/players/${p.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button onClick={openAdd} className="btn btn-primary">
        + Add player
      </button>
      <button onClick={() => setOpen(true)} className="btn btn-ghost">
        Manage
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-pitch-950/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="glass my-8 w-full max-w-2xl rounded-3xl p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="section-title">
                {editingId ? "Edit player" : "Add player"}
              </h2>
              <button onClick={() => setOpen(false)} className="btn btn-ghost !px-3 !py-1.5 !text-xs">
                Close
              </button>
            </div>

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

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="p-name">Full name *</label>
                <input
                  id="p-name"
                  className="field"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Ahmed Hassan"
                />
              </div>
              <div>
                <label className="label" htmlFor="p-nick">Nickname</label>
                <input
                  id="p-nick"
                  className="field"
                  value={form.nickname}
                  onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
                  placeholder="How the squad knows him"
                />
              </div>
              <div>
                <label className="label" htmlFor="p-club">Favorite club</label>
                <input
                  id="p-club"
                  className="field"
                  value={form.club}
                  onChange={(e) => setForm((f) => ({ ...f, club: e.target.value }))}
                  placeholder="Real Madrid"
                />
              </div>
              <div>
                <label className="label">Profile photo</label>
                <div className="flex items-center gap-3">
                  {form.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.photoUrl}
                      alt="Preview"
                      className="size-12 rounded-full object-cover ring-2 ring-volt-400/60"
                    />
                  ) : (
                    <span className="grid size-12 place-items-center rounded-full bg-pitch-700 text-white/40">
                      ?
                    </span>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="btn btn-ghost !px-3 !py-1.5 !text-xs"
                    disabled={busy}
                  >
                    {busy ? "Uploading…" : "Upload photo"}
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2.5 text-sm text-white/70 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="size-4 accent-volt-400"
                />
                Active (inactive players keep their history but can’t play new matches)
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={save} className="btn btn-primary" disabled={busy || !form.name.trim()}>
                {editingId ? "Save changes" : "Add player"}
              </button>
              {editingId && (
                <button onClick={() => { setEditingId(null); setForm(emptyForm); }} className="btn btn-ghost">
                  Cancel edit
                </button>
              )}
            </div>

            <div className="mt-8 border-t border-white/10 pt-6">
              <p className="label">Roster — edit or deactivate</p>
              <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-2.5"
                  >
                    <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {p.nickname || p.name}
                        {!p.active && <span className="ml-2 text-[0.65rem] text-white/35">inactive</span>}
                      </p>
                      <p className="truncate text-xs text-white/40">{p.club ?? "—"}</p>
                    </div>
                    <button onClick={() => openEdit(p)} className="btn btn-ghost !px-2.5 !py-1 !text-xs">
                      Edit
                    </button>
                    {p.active && (
                      <button
                        onClick={() => deactivate(p)}
                        disabled={busy}
                        className={`btn !px-2.5 !py-1 !text-xs ${
                          confirmId === p.id ? "btn-danger" : "btn-ghost"
                        }`}
                      >
                        {confirmId === p.id ? "Confirm?" : "Deactivate"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
