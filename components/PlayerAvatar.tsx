import Image from "next/image";

export default function PlayerAvatar({
  name,
  photoUrl,
  size = 44,
  ring = false,
  className = "",
}: {
  name: string;
  photoUrl: string | null;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-pitch-700 font-display font-bold text-white/70 ${
        ring ? "ring-2 ring-volt-400/70 ring-offset-2 ring-offset-pitch-950" : ""
      } ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.34) }}
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={name}
          width={size * 2}
          height={size * 2}
          className="h-full w-full object-cover"
        />
      ) : (
        initials
      )}
    </span>
  );
}
