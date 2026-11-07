import { initialsFor, personBgClass, type PersonColor } from "@/lib/people";

const sizes = {
  52: "size-[52px] text-[17px] font-extrabold",
  40: "size-10 text-[13px] font-extrabold",
  36: "size-9 text-xs font-extrabold",
  34: "size-[34px] text-xs font-bold",
  32: "size-8 text-[11px] font-extrabold",
  28: "size-7 text-[11px] font-extrabold",
} as const;

export type AvatarSize = keyof typeof sizes;

type AvatarProps = {
  name: string;
  color: PersonColor;
  size?: AvatarSize;
  /** Set to make the avatar meaningful to screen readers; hidden otherwise. */
  label?: string;
  /** Replaces the initials, like "You" for the viewer in the lobby's people list. */
  text?: string;
  className?: string;
};

/** A person's initials on their person color. */
export function Avatar({ name, color, size = 36, label, text, className = "" }: AvatarProps) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`inline-flex shrink-0 items-center justify-center rounded-full leading-none text-white ${personBgClass[color]} ${sizes[size]} ${className}`}
    >
      {text ?? initialsFor(name)}
    </span>
  );
}

export type StackPerson = { name: string; color: PersonColor };

type AvatarStackProps = {
  people: StackPerson[];
  /** How many to show before collapsing the rest into "+N". */
  max?: number;
  size?: 34 | 28;
  /** The ring color: white on a card, page on the page background. */
  ring?: "surface" | "page";
  label: string;
};

/** Overlapping avatars, like the "who's in" row on the Join screen. */
export function AvatarStack({
  people,
  max = 3,
  size = 34,
  ring = "surface",
  label,
}: AvatarStackProps) {
  const shown = people.length > max ? people.slice(0, max) : people;
  const overflow = people.length - shown.length;
  const ringClass =
    ring === "surface" ? "border-[2.5px] border-surface" : "border-2 border-page";
  const overlap = size === 34 ? "-ml-[9px]" : "-ml-2";
  const pill =
    size === 34
      ? "h-[34px] min-w-[34px] px-2 text-xs"
      : "h-7 min-w-7 px-1.5 text-[11px]";

  return (
    <div className="flex items-center" role="img" aria-label={label}>
      {shown.map((person, i) => (
        <Avatar
          key={`${person.color}-${person.name}-${i}`}
          name={person.name}
          color={person.color}
          size={size}
          className={`${ringClass} ${i === 0 ? "" : overlap}`}
        />
      ))}
      {overflow > 0 ? (
        <span
          className={`flex items-center justify-center rounded-full bg-tint font-extrabold text-ink ${pill} ${ringClass} ${overlap}`}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
