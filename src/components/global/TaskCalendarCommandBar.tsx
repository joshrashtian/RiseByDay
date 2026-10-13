import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { DateTime } from "luxon";
import { motion } from "motion/react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  IoArrowUp,
  IoCalendarOutline,
  IoDocumentTextOutline,
  IoPricetagsOutline,
  IoSparkles,
  IoTerminalOutline,
  IoTimeOutline,
  IoWarning,
} from "react-icons/io5";
import { useShallow } from "zustand/react/shallow";
import {
  parseTaskChatInput,
  type TaskChatHint,
  type TaskChatParse,
} from "../tasks/functions/parseTokens";
import { useTasksStore } from "../../stores/tasksStore";
import { useHomeFocusStore } from "../../stores/homeFocusStore";
import { usePomodoroStore } from "../../stores/pomodoroStore";
import { getActiveBlockNameAt } from "../../lib/taskBlocks";
import { runCommand, type Feedback } from "./commandbar/commands";
import {
  CATEGORY_TOKEN_TAIL_RE,
  extractInlineCategoryQuery,
  formatCategoryToken,
  parseCategoryPartialLabel,
  sanitizeCategoryValue,
} from "./commandbar/categoryHelpers";
import { CategoryPicker } from "./commandbar/CategoryPicker";
import { isCalendarGridPath } from "../../lib/calendarRoutes";
import { segmentTaskInput, type TaskTokenKind } from "../../lib/taskTokenSegments";

const TOKEN_HINT_KEYS = new Set([
  "due",
  "tag",
  "category",
  "block",
  "priority",
  "critical",
]);

// Text versions of the token pill colours below, readable on the light and dark surface.
const TOKEN_TEXT_COLORS: Record<TaskTokenKind, string> = {
  due: "text-accent",
  tag: "text-emerald-600 dark:text-emerald-400",
  category: "text-teal-600 dark:text-teal-400",
  block: "text-violet-600 dark:text-violet-400",
  priority: "text-amber-600 dark:text-amber-400",
  critical: "text-rose-600 dark:text-rose-400",
};

// Shared by the input and its highlight mirror so the glyphs line up exactly.
const INPUT_TEXT_CLASSES = "w-full text-sm whitespace-pre";

function buildSummary(parsed: TaskChatParse): string {
  const parts: string[] = [];

  if (parsed.title) parts.push(`Add "${parsed.title}"`);

  if (parsed.dueDate) {
    const dt = DateTime.fromJSDate(parsed.dueDate);
    const today = DateTime.local().startOf("day");
    const tomorrow = today.plus({ days: 1 });
    let dateStr: string;
    if (dt.startOf("day").valueOf() === today.valueOf()) {
      dateStr = "Today";
    } else if (dt.startOf("day").valueOf() === tomorrow.valueOf()) {
      dateStr = "Tomorrow";
    } else {
      dateStr = dt.toFormat("ccc, d MMM");
    }
    parts.push(`due ${dateStr}`);
  }

  if (parsed.block) parts.push(`in "${parsed.block}"`);
  if (parsed.category) parts.push(`filed under "${parsed.category}"`);

  if (parsed.tags?.length) {
    parts.push(`tagged ${parsed.tags.map((t) => `#${t}`).join(", ")}`);
  }

  if (parsed.critical) parts.push("marked critical");
  else if (parsed.priority) parts.push(`marked ${parsed.priority} priority`);

  if (!parts.length) return "";
  return parts.join(", ") + ".";
}

type PillConfig = {
  className: string;
  icon: React.ReactNode;
  label: string;
};

function getPillConfig(hint: TaskChatHint): PillConfig {
  const stripPrefix = (prefix: string) =>
    hint.label.startsWith(prefix)
      ? hint.label.slice(prefix.length)
      : hint.label;

  if (hint.partial) {
    return {
      className:
        "border border-amber-400/80 bg-amber-100/70 text-amber-900 dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-200",
      icon: null,
      label: hint.label,
    };
  }

  switch (hint.key) {
    case "due": {
      const cleaned = hint.label.replace(
        /^(?:Date|Time|At|End(?:\s+Date)?|End(?:\s+Time)?): /,
        "",
      );
      return {
        className: "bg-accent text-white",
        icon: <IoCalendarOutline className="h-3 w-3" />,
        label: cleaned,
      };
    }
    case "tag":
      return {
        className: "bg-emerald-500 text-white",
        icon: <IoPricetagsOutline className="h-3 w-3" />,
        label: `# ${stripPrefix("Tag: ")}`,
      };
    case "category":
      return {
        className: "bg-teal-600 text-white",
        icon: <IoDocumentTextOutline className="h-3 w-3" />,
        label: `"${stripPrefix("Category: ")}"`,
      };
    case "block":
      return {
        className: "bg-violet-500 text-white",
        icon: <IoTimeOutline className="h-3 w-3" />,
        label: stripPrefix("Block: "),
      };
    case "priority":
      return {
        className: "bg-amber-500 text-white",
        icon: null,
        label: hint.label,
      };
    case "critical":
      return {
        className: "bg-rose-600 text-white",
        icon: <IoWarning className="h-3 w-3" />,
        label: "Critical",
      };
    default:
      return {
        className:
          "border border-line-strong/80 bg-sunken/70 text-muted",
        icon: null,
        label: hint.label,
      };
  }
}

type Mode = "task" | "calendar";

type TaskCalendarCommandBarProps = {
  /** Horizontal insets so the bar centers over the content, not the side panels. */
  left?: number;
  right?: number;
  /** Drop beneath the overlay scrim while a floating side panel is open. */
  belowOverlay?: boolean;
  /** Called after a task is added (the cognition window uses it to hide itself). */
  onTaskAdded?: () => void;
};

export function TaskCalendarCommandBar({
  left = 0,
  right = 0,
  belowOverlay = false,
  onTaskAdded,
}: TaskCalendarCommandBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [raw, setRaw] = useState("");
  const [manualMode, setManualMode] = useState<Mode | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [highlightedCategoryIndex, setHighlightedCategoryIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const routeMode: Mode = useMemo(() => {
    if (isCalendarGridPath(location.pathname)) return "calendar";
    return "task";
  }, [location.pathname]);
  const mode: Mode = manualMode ?? routeMode;

  const { tasks, addTask, toggleTask, removeTask } = useTasksStore(
    useShallow((s) => ({
      tasks: s.tasks,
      addTask: s.addTask,
      toggleTask: s.toggleTask,
      removeTask: s.removeTask,
    })),
  );
  const setFocusedTaskId = useHomeFocusStore((s) => s.setFocusedTaskId);
  const setLinkedTaskTitle = usePomodoroStore((s) => s.setLinkedTaskTitle);

  const calendarDay = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const dayParam = params.get("day");
    const day = dayParam
      ? DateTime.fromISO(dayParam, { zone: "local" }).startOf("day")
      : DateTime.local().startOf("day");
    return day.isValid ? day : DateTime.local().startOf("day");
  }, [location.search]);

  const taskParsePreview = useMemo(() => {
    const input = raw.trim();
    if (!input || input.startsWith("/")) return null;
    return parseTaskChatInput(input);
  }, [raw]);

  const knownCategories = useMemo(() => {
    const byLower = new Map<string, string>();
    for (const task of tasks) {
      const c = task.category?.trim();
      if (!c) continue;
      if (!byLower.has(c.toLowerCase())) byLower.set(c.toLowerCase(), c);
    }
    return [...byLower.values()].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [tasks]);

  const activeCategoryQuery = useMemo(() => {
    const inline = extractInlineCategoryQuery(raw);
    if (inline !== null) return inline;

    const hint = taskParsePreview?.hints.find(
      (h) => h.key === "category" && h.partial,
    );
    if (!hint) return null;
    return parseCategoryPartialLabel(hint.label);
  }, [raw, taskParsePreview]);

  const categorySuggestions = useMemo(() => {
    if (activeCategoryQuery === null) return [];
    const query = sanitizeCategoryValue(activeCategoryQuery);
    if (!query) return knownCategories.slice(0, 6);
    return knownCategories
      .filter((c) => c.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 6);
  }, [knownCategories, activeCategoryQuery]);

  const categoryOptionRows = useMemo(() => {
    const rows: Array<{ label: string; value: string; isCreate?: boolean }> =
      [];
    const draftValue = sanitizeCategoryValue(categoryDraft);
    const hasExactMatch = draftValue
      ? categorySuggestions.some(
          (c) => c.toLowerCase() === draftValue.toLowerCase(),
        )
      : false;
    if (draftValue && !hasExactMatch) {
      rows.push({
        label: `Use "${draftValue}"`,
        value: draftValue,
        isCreate: true,
      });
    }
    rows.push(...categorySuggestions.map((c) => ({ label: c, value: c })));
    return rows;
  }, [categorySuggestions, categoryDraft]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.shiftKey || event.altKey) return;
      if (event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setManualMode(null);
  }, [location.pathname]);

  useEffect(() => {
    if (activeCategoryQuery === null) return;
    setCategoryDraft(sanitizeCategoryValue(activeCategoryQuery));
  }, [activeCategoryQuery]);

  useEffect(() => {
    if (!categoryOptionRows.length) {
      setHighlightedCategoryIndex(-1);
      return;
    }
    setHighlightedCategoryIndex((prev) =>
      prev >= 0 && prev < categoryOptionRows.length ? prev : 0,
    );
  }, [categoryOptionRows]);

  const setCalendarDay = (nextDay: DateTime) => {
    const params = new URLSearchParams(location.search);
    params.set(
      "day",
      nextDay.toISODate() ?? DateTime.local().toISODate() ?? "",
    );
    navigate(
      { pathname: "/calendar", search: `?${params.toString()}` },
      { replace: true },
    );
  };

  const submitTask = (input: string) => {
    const parsed = parseTaskChatInput(input);
    if (!parsed.title.trim()) {
      setFeedback({ tone: "error", text: "Task title is missing." });
      return;
    }
    if (parsed.hints.some((h) => h.partial)) {
      setFeedback({ tone: "error", text: "Finish the partial token first." });
      return;
    }

    const fallbackDueDate =
      mode === "calendar" && !parsed.dueDate
        ? calendarDay.endOf("day").toJSDate()
        : undefined;
    const effectiveDueDate = parsed.dueDate ?? fallbackDueDate;
    const blockMinuteSource = effectiveDueDate ?? new Date();
    const minuteOfDay =
      blockMinuteSource.getHours() * 60 + blockMinuteSource.getMinutes();
    const autoBlockName = getActiveBlockNameAt(minuteOfDay);

    addTask({
      title: parsed.title.trim(),
      ...(parsed.priority ? { priority: parsed.priority } : {}),
      ...(parsed.critical ? { critical: true } : {}),
      ...(parsed.block
        ? { block: parsed.block }
        : autoBlockName
          ? { block: autoBlockName }
          : {}),
      ...(parsed.category ? { category: parsed.category } : {}),
      ...(parsed.tags ? { tags: parsed.tags } : {}),
      ...(parsed.dueDate ? { dueDate: parsed.dueDate } : {}),
      ...(parsed.endDate ? { endDate: parsed.endDate } : {}),
      ...(fallbackDueDate ? { dueDate: fallbackDueDate } : {}),
    });

    setFeedback({
      tone: "success",
      text:
        mode === "calendar" && !parsed.dueDate
          ? `Task added for ${calendarDay.toFormat("ccc, d MMM")} (end of day).`
          : "Task added.",
    });
    setRaw("");
    onTaskAdded?.();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input = raw.trim();
    if (!input) return;
    if (input.startsWith("/")) {
      runCommand(input, {
        tasks,
        toggleTask,
        removeTask,
        setFocusedTaskId,
        setLinkedTaskTitle,
        calendarDay,
        setCalendarDay,
        setFeedback,
        setRaw,
        navigate,
      });
    } else {
      submitTask(input);
    }
  };

  const applyCategoryToken = (value: string) => {
    const token = formatCategoryToken(value);
    if (!token) return;

    setRaw((prev) => {
      const maybeReplaced = prev.replace(CATEGORY_TOKEN_TAIL_RE, token);
      if (maybeReplaced !== prev) return `${maybeReplaced} `;
      const spacer = prev.trimEnd().length > 0 ? " " : "";
      return `${prev.trimEnd()}${spacer}${token} `;
    });
    inputRef.current?.focus();
  };

  const onMainInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (activeCategoryQuery === null || !categoryOptionRows.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedCategoryIndex(
        Math.min(highlightedCategoryIndex + 1, categoryOptionRows.length - 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedCategoryIndex(Math.max(highlightedCategoryIndex - 1, 0));
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const option =
        categoryOptionRows[highlightedCategoryIndex] ?? categoryOptionRows[0];
      if (!option) return;
      setCategoryDraft(option.value);
      applyCategoryToken(option.value);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const option =
        categoryOptionRows[highlightedCategoryIndex] ?? categoryOptionRows[0];
      if (option) applyCategoryToken(option.value);
    }
  };

  // The input scrolls horizontally once text overflows; keep the mirror in step.
  const syncMirrorScroll = () => {
    if (mirrorRef.current && inputRef.current)
      mirrorRef.current.scrollLeft = inputRef.current.scrollLeft;
  };
  useEffect(syncMirrorScroll, [raw]);

  const trimmed = raw.trim();
  const isCommandInput = trimmed.startsWith("/");
  const isTaskInput = trimmed.length > 0 && !isCommandInput;
  const isUnderstood =
    isTaskInput && !taskParsePreview?.hints.some((h) => h.partial);
  const summary = taskParsePreview ? buildSummary(taskParsePreview) : "";
  const tokenHints =
    taskParsePreview?.hints.filter((h) => TOKEN_HINT_KEYS.has(h.key)) ?? [];

  const inputIcon = isCommandInput ? (
    <IoTerminalOutline className="h-3.5 w-3.5 text-faint" />
  ) : mode === "calendar" ? (
    <IoCalendarOutline className="h-3.5 w-3.5 text-faint" />
  ) : (
    <IoSparkles className="h-3.5 w-3.5 text-faint dark:text-blue-300" />
  );

  return (
    <div
      className={`pointer-events-none fixed bottom-3 flex justify-center ${
        belowOverlay ? "z-30" : "z-50"
      }`}
      style={{ left, right }}
    >
      <form
        onSubmit={onSubmit}
        className="pointer-events-auto relative w-[min(92%,760px)]"
      >
        {activeCategoryQuery !== null ? (
          <CategoryPicker
            categoryDraft={categoryDraft}
            setCategoryDraft={setCategoryDraft}
            categoryOptionRows={categoryOptionRows}
            highlightedCategoryIndex={highlightedCategoryIndex}
            setHighlightedCategoryIndex={setHighlightedCategoryIndex}
            applyCategoryToken={applyCategoryToken}
          />
        ) : null}

        <div className=" rounded-2xl border bg-surface/60 backdrop-blur-2xl drop-shadow-2xl">
          {(isTaskInput || isCommandInput) && (
            <div className="px-5 pt-4 pb-3">
              {isTaskInput && (
                <div className="mb-2.5 flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${isUnderstood ? "bg-emerald-500" : "bg-amber-400"}`}
                  />
                  <span
                    className={`text-[10px] font-bold uppercase tracking-[0.12em] ${isUnderstood ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
                  >
                    Cognition · {isUnderstood ? "Understood" : "Parsing…"}
                  </span>
                </div>
              )}

              <motion.p
                className={`font-display text-sm font-bold italic leading-snug ${
                  isCommandInput
                    ? feedback?.tone === "error"
                      ? "text-rose-600 dark:text-rose-400"
                      : feedback?.tone === "success"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted"
                    : "text-ink"
                }`}
              >
                {isCommandInput
                  ? (feedback?.text.split("").map((c, i) => (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        key={i}
                      >
                        {c}
                      </motion.span>
                    )) ?? "Type a command…")
                  : summary.split("").map((c, i) => (
                      <motion.span
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.01 }}
                        key={i}
                        className="z-50"
                      >
                        {c}
                      </motion.span>
                    ))}
              </motion.p>

              {isTaskInput && tokenHints.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {tokenHints.map((hint, i) => {
                    const config = getPillConfig(hint);
                    return (
                      <span
                        key={`${hint.key}-${i}`}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${config.className}`}
                      >
                        {config.icon}
                        {config.label}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div
            className={`flex items-center gap-2 px-5 ${isTaskInput ? "border-t border-line py-3" : "py-3"}`}
          >
            {inputIcon}
            <div className="relative min-w-0 flex-1">
              <div
                ref={mirrorRef}
                aria-hidden
                className={`${INPUT_TEXT_CLASSES} pointer-events-none absolute inset-0 overflow-hidden text-muted`}
              >
                {isCommandInput
                  ? raw
                  : segmentTaskInput(raw).map((seg, i) => (
                      <span
                        key={i}
                        className={seg.kind ? TOKEN_TEXT_COLORS[seg.kind] : undefined}
                      >
                        {seg.text}
                      </span>
                    ))}
              </div>
              <input
                ref={inputRef}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                onKeyDown={onMainInputKeyDown}
                onScroll={syncMirrorScroll}
                onSelect={syncMirrorScroll}
                placeholder="Task..."
                className={`${INPUT_TEXT_CLASSES} relative block bg-transparent text-transparent caret-ink outline-none placeholder:text-faint`}
                aria-label="Global command input"
              />
            </div>
            <button
              type="submit"
              disabled={!raw.trim() || (isTaskInput && !isUnderstood)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white transition-colors hover:bg-ink disabled:opacity-40"
              aria-label="Submit"
            >
              <IoArrowUp className="h-4 w-4" />
            </button>
          </div>

          {!isTaskInput && !isCommandInput && feedback && (
            <p
              className={`px-5 pb-3 font-eudoxus text-xs font-semibold italic ${
                feedback.tone === "error"
                  ? "text-rose-600 dark:text-rose-400"
                  : feedback.tone === "success"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted"
              }`}
            >
              {feedback.text}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
