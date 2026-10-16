/** A stable colour (0 to 5) for a name, so a person looks the same everywhere. */
export function colorIndex(name: string): number {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  return hash % 6;
}

/** A round badge with the first letter of a name. Decorative: the name is always written out next to it. */
export function Avatar(props: { name: string }) {
  const initial = [...props.name.trim()][0]?.toUpperCase() ?? '?';
  return (
    <span class={`avatar c${colorIndex(props.name)}`} aria-hidden="true">
      {initial}
    </span>
  );
}
