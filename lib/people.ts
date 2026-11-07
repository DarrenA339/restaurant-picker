/**
 * People in a session: person colors and avatar initials. Pure helpers shared
 * by server and client code. The colors themselves live in app/globals.css as
 * --color-person-1 … --color-person-8; the database stores the number.
 */

export const PERSON_COLORS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export type PersonColor = (typeof PERSON_COLORS)[number];

export const MAX_MEMBERS = PERSON_COLORS.length;

/** Tailwind classes, listed out so the compiler sees every one. */
export const personBgClass: Record<PersonColor, string> = {
  1: "bg-person-1",
  2: "bg-person-2",
  3: "bg-person-3",
  4: "bg-person-4",
  5: "bg-person-5",
  6: "bg-person-6",
  7: "bg-person-7",
  8: "bg-person-8",
};

export const personColorName: Record<PersonColor, string> = {
  1: "Ink",
  2: "Blue",
  3: "Purple",
  4: "Green",
  5: "Rust",
  6: "Plum",
  7: "Slate",
  8: "Olive",
};

export function isPersonColor(value: unknown): value is PersonColor {
  return (
    typeof value === "number" &&
    (PERSON_COLORS as readonly number[]).includes(value)
  );
}

/** Colors nobody in the session has yet, lowest first. */
export function freeColors(taken: Iterable<number>): PersonColor[] {
  const used = new Set(taken);
  return PERSON_COLORS.filter((color) => !used.has(color));
}

/** "Maya Kim" → "MK", "Nia" → "NI", "" → "?". */
export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters =
    words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0];
  return letters.toUpperCase();
}

/** "Maya, Sam and Tyler are in", plus a longer form for screen readers. */
export function whoIsIn(names: string[]): { text: string; label: string } {
  const n = names.length;
  if (n === 0) return { text: "Nobody here yet", label: "Nobody has joined" };
  const text =
    n === 1
      ? `${names[0]} is in`
      : n === 2
        ? `${names[0]} and ${names[1]} are in`
        : n === 3
          ? `${names[0]}, ${names[1]} and ${names[2]} are in`
          : `${names[0]}, ${names[1]} and ${n - 2} others are in`;
  const label =
    n === 1
      ? `${names[0]} has joined`
      : `${names.slice(0, -1).join(", ")} and ${names[n - 1]} have joined`;
  return { text, label };
}
