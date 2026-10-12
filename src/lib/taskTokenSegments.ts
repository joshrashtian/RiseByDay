/**
 * Splits raw task input into plain-text and token segments for syntax
 * highlighting. Mirrors the prefixes `parseTaskChatInput` understands, but only
 * to colour them: it does not validate dates or resolve values.
 */

export type TaskTokenKind =
  | "critical"
  | "priority"
  | "category"
  | "due"
  | "tag"
  | "block";

export type TaskTokenSegment = {
  text: string;
  kind?: TaskTokenKind;
};

// Order matters: longer prefixes (!!, @@) must win over their single forms.
const TOKEN_RE = new RegExp(
  [
    String.raw`(?<critical>!!(?=\s|$))`,
    String.raw`(?<priority>!(?:high|h|medium|m|low|l)(?=\s|$)|!(?=\s))`,
    String.raw`(?<category>@@\s*(?:"[^"]*"?|'[^']*'?|“[^”]*”?|[\w.-]*))`,
    String.raw`(?<due>@\S*)`,
    String.raw`(?<tag>#[\w.-]*)`,
    String.raw`(?<block>%(?:"[^"]*"?|'[^']*'?|[\w.-]*))`,
  ]
    .map((p) => String.raw`(?<=^|\s)` + p)
    .join("|"),
  "gi",
);

export function segmentTaskInput(raw: string): TaskTokenSegment[] {
  const segments: TaskTokenSegment[] = [];
  let last = 0;

  for (const m of raw.matchAll(TOKEN_RE)) {
    const start = m.index ?? 0;
    if (start > last) segments.push({ text: raw.slice(last, start) });
    const kind = Object.entries(m.groups ?? {}).find(([, v]) => v)?.[0];
    segments.push({ text: m[0], kind: kind as TaskTokenKind });
    last = start + m[0].length;
  }

  if (last < raw.length) segments.push({ text: raw.slice(last) });
  return segments;
}
