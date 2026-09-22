import { redirect } from "next/navigation";
import SettingsForm from "@/components/SettingsForm";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/login?next=/settings");
  const settings = getSettings();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="label">League configuration</p>
        <h1 className="heading-display text-3xl text-white sm:text-4xl">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          Points rules apply to new calculations instantly — standings and awards are always
          recomputed from match history, so nothing gets out of sync.
        </p>
      </header>
      <SettingsForm
        initialSettings={settings}
        username={user.username}
      />
    </div>
  );
}
