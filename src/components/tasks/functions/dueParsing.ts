import { DateTime } from "luxon";
import { parseDueLocalInput } from "../../../lib/taskDates";

export const TIME_PARSE_FORMATS = [
  "h:mma",
  "h:mm a",
  "ha",
  "h a",
  "HH:mm",
  "H:mm",
] as const;

export type ParsedDueToken =
  | { kind: "time"; hour: number; minute: number; label: string }
  | { kind: "date"; date: DateTime; label: string; weekday?: boolean }
  | { kind: "datetime"; dateTime: DateTime; label: string };

export type ParsedDueRangeToken = {
  start: ParsedDueToken;
  end: ParsedDueToken;
};

export type DueParts = {
  date?: DateTime;
  /** The date came from a weekday name, so it may roll forward a week. */
  dateIsWeekday?: boolean;
  time?: { hour: number; minute: number };
  dateTime?: DateTime;
};

export function parseTimeToken(
  value: string,
): { hour: number; minute: number } | undefined {
  for (const fmt of TIME_PARSE_FORMATS) {
    const parsed = DateTime.fromFormat(value, fmt, { zone: "local" });
    if (parsed.isValid) return { hour: parsed.hour, minute: parsed.minute };
    const lowerParsed = DateTime.fromFormat(value.toLowerCase(), fmt, {
      zone: "local",
    });
    if (lowerParsed.isValid) {
      return { hour: lowerParsed.hour, minute: lowerParsed.minute };
    }
  }
  return undefined;
}

// Luxon weekday numbers: Monday = 1 … Sunday = 7.
const WEEKDAY_NAMES: Record<string, number> = {
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
  sun: 7, sunday: 7,
};

/** Next occurrence of a named weekday (today counts), at start of day. */
export function parseWeekdayToken(
  value: string,
  now: DateTime = DateTime.now().setZone("local"),
): DateTime | undefined {
  const weekday = WEEKDAY_NAMES[value.trim().toLowerCase()];
  if (!weekday) return undefined;
  const daysAhead = (weekday - now.weekday + 7) % 7;
  return now.plus({ days: daysAhead }).startOf("day");
}

export function parseDueTokenArg(arg: string): ParsedDueToken | undefined {
  const trimmed = arg.trim();
  if (!trimmed) return undefined;

  const now = DateTime.now().setZone("local");
  const lower = trimmed.toLowerCase();

  if (lower === "today") {
    const date = now.startOf("day");
    return {
      kind: "date",
      date,
      label: `Date: ${date.toFormat("EEE d MMM")}`,
    };
  }
  if (lower === "tomorrow") {
    const date = now.plus({ days: 1 }).startOf("day");
    return {
      kind: "date",
      date,
      label: `Date: ${date.toFormat("EEE d MMM")}`,
    };
  }
  if (lower === "tonight") {
    return { kind: "time", hour: 18, minute: 0, label: "Time: 6:00 PM" };
  }

  const weekday = parseWeekdayToken(lower, now);
  if (weekday) {
    return {
      kind: "date",
      date: weekday,
      label: `Date: ${weekday.toFormat("EEE d MMM")}`,
      weekday: true,
    };
  }

  const asTime = parseTimeToken(trimmed);
  if (asTime) {
    return {
      kind: "time",
      hour: asTime.hour,
      minute: asTime.minute,
      label: `Time: ${DateTime.fromObject({ hour: asTime.hour, minute: asTime.minute }).toFormat("h:mm a")}`,
    };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = DateTime.fromISO(trimmed, { zone: "local" }).startOf("day");
    if (d.isValid) {
      return {
        kind: "date",
        date: d,
        label: `Date: ${d.toFormat("EEE d MMM")}`,
      };
    }
  }

  const mdY = DateTime.fromFormat(trimmed, "M/d/yyyy", { zone: "local" });
  if (mdY.isValid) {
    const date = mdY.startOf("day");
    return {
      kind: "date",
      date,
      label: `Date: ${date.toFormat("EEE d MMM")}`,
    };
  }

  const md = DateTime.fromFormat(trimmed, "M/d", { zone: "local" });
  if (md.isValid) {
    let date = md.set({ year: now.year }).startOf("day");
    if (date < now.startOf("day")) date = date.plus({ years: 1 });
    return {
      kind: "date",
      date,
      label: `Date: ${date.toFormat("EEE d MMM")}`,
    };
  }

  const parsedLocal = parseDueLocalInput(trimmed);
  if (parsedLocal) {
    const dt = DateTime.fromJSDate(parsedLocal).setZone("local");
    if (!dt.isValid) return undefined;
    const hasTime =
      /[ap]m/i.test(trimmed) ||
      /:\d{1,2}/.test(trimmed) ||
      /t\d{1,2}/i.test(trimmed);
    if (hasTime) {
      return {
        kind: "datetime",
        dateTime: dt,
        label: `At: ${dt.toLocaleString(DateTime.DATETIME_MED)}`,
      };
    }
    return {
      kind: "date",
      date: dt.startOf("day"),
      label: `Date: ${dt.toFormat("EEE d MMM")}`,
    };
  }

  const iso = DateTime.fromISO(trimmed, { zone: "local" });
  if (iso.isValid) {
    if (trimmed.includes("T")) {
      return {
        kind: "datetime",
        dateTime: iso,
        label: `At: ${iso.toLocaleString(DateTime.DATETIME_MED)}`,
      };
    }
    const date = iso.startOf("day");
    return {
      kind: "date",
      date,
      label: `Date: ${date.toFormat("EEE d MMM")}`,
    };
  }

  return undefined;
}

export function parseInlineDueRangeArg(
  arg: string,
): ParsedDueRangeToken | undefined {
  const trimmed = arg.trim();
  if (!trimmed) return undefined;

  const parseSplit = (leftRaw: string, rightRaw: string) => {
    const left = leftRaw.trim();
    const right = rightRaw.trim();
    if (!left || !right) return undefined;
    const start = parseDueTokenArg(left);
    const end = parseDueTokenArg(right);
    if (!start || !end) return undefined;
    return { start, end };
  };

  if (trimmed.includes("->")) {
    const [left, right, ...rest] = trimmed.split("->");
    if (rest.length === 0 && left && right) return parseSplit(left, right);
  }

  for (let i = 1; i < trimmed.length - 1; i++) {
    if (trimmed[i] !== "-") continue;
    const parsed = parseSplit(trimmed.slice(0, i), trimmed.slice(i + 1));
    if (parsed) return parsed;
  }

  return undefined;
}

export function applyDueToken(
  target: DueParts,
  parsed: ParsedDueToken,
): DueParts {
  if (parsed.kind === "datetime") {
    return { ...target, dateTime: parsed.dateTime };
  }
  if (parsed.kind === "date") {
    return { ...target, date: parsed.date, dateIsWeekday: parsed.weekday };
  }
  return {
    ...target,
    time: { hour: parsed.hour, minute: parsed.minute },
  };
}

export function resolveDueParts(
  parts: DueParts,
  baseDay: DateTime,
): DateTime | undefined {
  if (parts.dateTime) return parts.dateTime;
  if (parts.date && parts.time) {
    return parts.date.set({
      hour: parts.time.hour,
      minute: parts.time.minute,
      second: 0,
      millisecond: 0,
    });
  }
  if (parts.date) {
    return parts.date.set({
      hour: 23,
      minute: 59,
      second: 0,
      millisecond: 0,
    });
  }
  if (parts.time) {
    return baseDay.set({
      hour: parts.time.hour,
      minute: parts.time.minute,
      second: 0,
      millisecond: 0,
    });
  }
  return undefined;
}

export function parseChatDueArg(arg: string): Date | undefined {
  const trimmed = arg.trim();
  if (!trimmed) return undefined;

  const iso = parseDueLocalInput(trimmed);
  if (iso) return iso;

  const now = DateTime.now().setZone("local");
  const lower = trimmed.toLowerCase();

  if (lower === "today") {
    return now
      .set({ hour: 23, minute: 59, second: 0, millisecond: 0 })
      .toJSDate();
  }
  if (lower === "tomorrow") {
    return now
      .plus({ days: 1 })
      .set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
      .toJSDate();
  }
  if (lower === "tonight") {
    return now
      .set({ hour: 18, minute: 0, second: 0, millisecond: 0 })
      .toJSDate();
  }

  const weekday = parseWeekdayToken(lower, now);
  if (weekday) {
    return weekday
      .set({ hour: 23, minute: 59, second: 0, millisecond: 0 })
      .toJSDate();
  }

  const tryTimeFormats = (s: string) => {
    const formats = ["h:mma", "h:mm a", "ha", "h a", "HH:mm", "H:mm"];
    for (const fmt of formats) {
      const dt = DateTime.fromFormat(s, fmt, { zone: "local" });
      if (dt.isValid) {
        return now
          .set({
            hour: dt.hour,
            minute: dt.minute,
            second: 0,
            millisecond: 0,
          })
          .toJSDate();
      }
    }
    return undefined;
  };

  const asTime = tryTimeFormats(trimmed) ?? tryTimeFormats(lower);
  if (asTime) return asTime;

  const mdY = DateTime.fromFormat(trimmed, "M/d/yyyy", { zone: "local" });
  if (mdY.isValid) return mdY.toJSDate();

  const md = DateTime.fromFormat(trimmed, "M/d", { zone: "local" });
  if (md.isValid) {
    let y = md.set({ year: now.year });
    if (y < now.startOf("day")) y = y.plus({ years: 1 });
    return y.toJSDate();
  }

  return undefined;
}
