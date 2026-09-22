import Link from "next/link";
import { redirect } from "next/navigation";
import RecordMatchWizard from "@/components/RecordMatchWizard";
import { getCurrentUser } from "@/lib/auth";
import { getAllPlayers } from "@/lib/players";
import { getMatch } from "@/lib/matches";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function RecordPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/login?next=/record");

  const { edit } = await searchParams;
  const editMatch = edit ? getMatch(Number(edit)) : null;
  const players = getAllPlayers();
  const settings = getSettings();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Under a minute, promise</p>
          <h1 className="heading-display text-3xl text-white sm:text-4xl">
            {editMatch ? "Edit match" : "Record a match"}
          </h1>
        </div>
        <Link href="/matches" className="btn btn-ghost">
          Match history
        </Link>
      </header>

      <RecordMatchWizard
        players={players}
        editMatch={editMatch}
        pointsConfig={{
          single: settings.pointsSingle,
          best_of_3: settings.pointsBestOf3,
          multiplayer: settings.pointsMultiplayer,
          multiplayer_best_of_3: settings.pointsMultiplayerBo3,
        }}
      />
    </div>
  );
}
