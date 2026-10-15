import { DateTime } from "luxon";
import { DEFAULT_BLOCK_SUGGESTIONS } from "../../../lib/blockSuggestions";
import type { TaskPriority } from "@/types";
import { normalizeTaskTags } from "../../../types/task";
import { parseLeadingCategoryToken } from "../../global/commandbar/categoryHelpers";
import {
  applyDueToken,
  parseInlineDueRangeArg,
  parseDueTokenArg,
  resolveDueParts,
  type DueParts,
} from "./dueParsing";

export type { DueParts } from "./dueParsing";
export { parseChatDueArg } from "./dueParsing";

export type TaskChatHint = {
  key: string;
  label: string;
  partial?: boolean;
};

export type TaskChatParse = {
  title: string;
  priority?: TaskPriority;
  critical?: boolean;
  block?: string;
  category?: string;
  tags?: string[];
  dueDate?: Date;
  endDate?: Date;
  hints: TaskChatHint[];
};

function splitFirstLine(s: string): [string, string] {
  const i = s.indexOf("\n");
  if (i === -1) return [s, ""];
  return [s.slice(0, i), s.slice(i)];
}

function mapPriorityToken(t: string): TaskPriority | undefined {
  const x = t.toLowerCase();
  if (x === "high" || x === "h") return "high";
  if (x === "medium" || x === "m") return "medium";
  if (x === "low" || x === "l") return "low";
  return undefined;
}

function dueHintLabel(d: Date): string {
  return `Due: ${DateTime.fromJSDate(d).toLocaleString(DateTime.DATETIME_MED)}`;
}

export function parseTaskChatInput(raw: string): TaskChatParse {
  const hints: TaskChatHint[] = [];
  let priority: TaskPriority | undefined;
  let critical: boolean | undefined;
  let block: string | undefined;
  let category: string | undefined;
  const tagAcc: string[] = [];
  let startDueParts: DueParts = {};
  let endDueParts: DueParts = {};
  let parsingRangeEnd = false;

  const trimmed = raw.replace(/^\s+/, "");
  const [line1, restMultiline] = splitFirstLine(trimmed);
  let work = line1;
  const titleParts: string[] = [];

  const consumeLeading = (): boolean => {
    work = work.replace(/^\s+/, "");
    if (!work) return false;

    // Range joins only make sense before any title text (e.g. @9am to 11pm)
    if (titleParts.length === 0) {
      const rangeJoin = work.match(/^(?:till|until|to|->)(\s|$)/i);
      if (rangeJoin) {
        parsingRangeEnd = true;
        work = work.slice(rangeJoin[0].length);
        hints.push({ key: "range", label: "Range end…" });
        return true;
      }
    }

    if (work.startsWith("!!")) {
      if (work.length === 2 || work[2] === " ") {
        critical = true;
        work = work.slice(2);
        hints.push({ key: "critical", label: "Critical" });
        return true;
      }
      return false;
    }

    if (work.startsWith("!")) {
      const after = work.slice(1);
      const named = after.match(/^(high|h|medium|m|low|l)(\s|$)/i);
      if (named) {
        const p = mapPriorityToken(named[1]);
        if (p) {
          priority = p;
          work = after.slice(named[0].length);
          hints.push({
            key: "priority",
            label: `Priority: ${p}`,
          });
          return true;
        }
      }

      if (after[0] === " ") {
        priority = "high";
        work = after.trimStart();
        hints.push({ key: "priority", label: "High priority" });
        return true;
      }
      return false;
    }

    if (work.startsWith("%")) {
      const quoted = work.match(
        /^%\s*(?:"([^"]+)"|'([^']+)'|"([^"]+)"|'([^']+)')(\s|$)/,
      );
      if (quoted) {
        const value = (
          quoted[1] ??
          quoted[2] ??
          quoted[3] ??
          quoted[4] ??
          ""
        ).trim();
        if (value) {
          block = value;
          work = work.slice(quoted[0].length);
          hints.push({ key: "block", label: `Block: ${block}` });
          return true;
        }
      }

      const lowerWork = work.toLowerCase();
      const match = [...DEFAULT_BLOCK_SUGGESTIONS]
        .sort((a, b) => b.length - a.length)
        .find((candidate) => {
          const withPrefix = `%${candidate}`.toLowerCase();
          if (!lowerWork.startsWith(withPrefix)) return false;
          const nextChar = work.charAt(withPrefix.length);
          return nextChar === "" || /\s/.test(nextChar);
        });
      if (match) {
        block = match;
        work = work.slice(match.length + 1);
        work = work.replace(/^\s+/, "");
        hints.push({ key: "block", label: `Block: ${block}` });
        return true;
      }

      const oneWord = work.match(/^%([\w.-]+)(\s|$)/);
      if (oneWord) {
        block = oneWord[1];
        work = work.slice(oneWord[0].length);
        hints.push({ key: "block", label: `Block: ${block}` });
        return true;
      }
      return false;
    }

    if (work.startsWith("@@")) {
      const parsed = parseLeadingCategoryToken(work);
      if (parsed?.kind === "complete") {
        category = parsed.value;
        work = parsed.remaining;
        hints.push({ key: "category", label: `Category: ${category}` });
        return true;
      }
      return false;
    }

    if (work.startsWith("#")) {
      const m = work.match(/^#([\w.-]+)(\s|$)/);
      if (m) {
        tagAcc.push(m[1]);
        work = work.slice(m[0].length);
        hints.push({ key: "tag", label: `Tag: ${m[1]}` });
        return true;
      }
      return false;
    }

    if (work.startsWith("@")) {
      const m = work.match(/^@(\S+)/);
      if (m) {
        const arg = m[1];
        if (!parsingRangeEnd) {
          const parsedRange = parseInlineDueRangeArg(arg);
          if (parsedRange) {
            startDueParts = applyDueToken(startDueParts, parsedRange.start);
            endDueParts = applyDueToken(endDueParts, parsedRange.end);
            hints.push({ key: "due", label: parsedRange.start.label });
            hints.push({ key: "due", label: `End ${parsedRange.end.label}` });
            work = work.slice(m[0].length);
            parsingRangeEnd = true;
            return true;
          }
        }
        const parsed = parseDueTokenArg(arg);
        if (parsed) {
          if (parsingRangeEnd) {
            endDueParts = applyDueToken(endDueParts, parsed);
            hints.push({ key: "due", label: `End ${parsed.label}` });
          } else {
            startDueParts = applyDueToken(startDueParts, parsed);
            hints.push({ key: "due", label: parsed.label });
          }
          work = work.slice(m[0].length);
          return true;
        }
      }
      return false;
    }

    return false;
  };

  const TOKEN_START_RE = /^(?:!!|!|@@|@|#|%)/;

  let guard = 0;
  while (guard++ < 200) {
    work = work.replace(/^\s+/, "");
    if (!work) break;

    if (consumeLeading()) continue;

    // Stop if the remainder looks like a token prefix (partial token detection below)
    if (TOKEN_START_RE.test(work)) break;

    // Consume the next whitespace-delimited word as title text
    const wordMatch = work.match(/^(\S+)/);
    if (!wordMatch) break;
    titleParts.push(wordMatch[1]);
    work = work.slice(wordMatch[0].length);
  }

  work = work.replace(/^\s+/, "");

  // Build title from collected words; exclude remaining partial-token prefix
  const isRemainingToken = TOKEN_START_RE.test(work);
  const titleCore = (
    [...titleParts, isRemainingToken ? "" : work]
      .filter(Boolean)
      .join(" ") + restMultiline
  ).trim();

  if (work) {
    if (work.startsWith("!!") && work.length > 2 && work[2] !== " ") {
      hints.push({ key: "critical", label: "Critical…", partial: true });
    } else if (work.startsWith("!") && !work.startsWith("!!")) {
      hints.push({ key: "priority", label: "Priority…", partial: true });
    } else if (work.startsWith("@@")) {
      const parsed = parseLeadingCategoryToken(work);
      if (parsed?.kind === "complete") {
        category = parsed.value;
        work = parsed.remaining;
        hints.push({ key: "category", label: `Category: ${category}` });
      } else {
        const fragment =
          parsed?.kind === "partial" ? parsed.fragment : work.slice(2).trimStart();
        hints.push({
          key: "category",
          label: fragment ? `Category: ${fragment}…` : "Category…",
          partial: true,
        });
      }
    } else if (work.startsWith("%")) {
      const rest = work.slice(1);
      hints.push({
        key: "block",
        label: rest ? `Block: ${rest}…` : "Block…",
        partial: true,
      });
    } else if (work.startsWith("#")) {
      const rest = work.slice(1);
      hints.push({
        key: "tag",
        label: rest ? `Tag: ${rest}…` : "Tag…",
        partial: true,
      });
    } else if (work.startsWith("@")) {
      const arg = work.slice(1);
      hints.push({
        key: "due",
        label: arg ? `Due: ${arg}…` : "Time…",
        partial: true,
      });
    }
  }

  const tags = normalizeTaskTags(tagAcc);
  const now = DateTime.now().setZone("local").startOf("day");
  const resolvedStart = resolveDueParts(startDueParts, now);
  let resolvedEnd = resolveDueParts(
    endDueParts,
    resolvedStart?.startOf("day") ?? now,
  );

  if (
    resolvedStart &&
    resolvedEnd &&
    resolvedEnd <= resolvedStart &&
    !endDueParts.date &&
    !endDueParts.dateTime
  ) {
    resolvedEnd = resolvedEnd.plus({ days: 1 });
  }

  // "@sat-sun" means the Sunday after Saturday, not the one before it.
  while (
    resolvedStart &&
    resolvedEnd &&
    resolvedEnd <= resolvedStart &&
    endDueParts.dateIsWeekday
  ) {
    resolvedEnd = resolvedEnd.plus({ weeks: 1 });
  }

  const dueDate = resolvedStart?.toJSDate();
  const endDate = resolvedEnd?.toJSDate();

  if (dueDate)
    hints.push({ key: "due-summary", label: dueHintLabel(dueDate) });
  if (endDate) {
    hints.push({
      key: "end-summary",
      label: `End: ${DateTime.fromJSDate(endDate).toLocaleString(DateTime.DATETIME_MED)}`,
    });
  }

  return {
    title: titleCore,
    ...(priority ? { priority } : {}),
    ...(critical ? { critical } : {}),
    ...(block ? { block } : {}),
    ...(category ? { category } : {}),
    ...(tags ? { tags } : {}),
    ...(dueDate ? { dueDate } : {}),
    ...(endDate ? { endDate } : {}),
    hints,
  };
}
