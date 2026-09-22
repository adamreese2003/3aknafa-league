import PlayerAvatar from "./PlayerAvatar";

export default function StatCard({
  label,
  value,
  sub,
  accent = "volt",
  player,
}: {
  label: string;
  value: string | number;
  sub?: string | null;
  accent?: "volt" | "ice" | "plain";
  player?: { name: string; photoUrl: string | null } | null;
}) {
  const valueColor =
    accent === "volt" ? "text-volt-300" : accent === "ice" ? "text-ice-300" : "text-white";
  return (
    <div className="glass glass-hover rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="label !mb-0">{label}</p>
        {player && <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size={36} />}
      </div>
      <p className={`mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl ${valueColor}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 truncate text-xs text-white/45">{sub}</p>}
    </div>
  );
}
