import { useEffect, useRef, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion } from "motion/react";
import { Pencil02 } from "@untitledui/icons";
import { parseTaskChatInput } from "../components/tasks/functions/parseTokens";
import { getActiveBlockNameAt } from "../lib/taskBlocks";
import { segmentTaskInput, type TaskTokenKind } from "../lib/taskTokenSegments";
import { useTasksStore } from "../stores/tasksStore";

const hide = () => void invoke("hide_cognition_bar");

// Same hues as the in-app command bar's token pills.
const TOKEN_COLORS: Record<TaskTokenKind, string> = {
  due: "text-sky-400",
  tag: "text-emerald-400",
  category: "text-teal-300",
  block: "text-violet-400",
  priority: "text-amber-400",
  critical: "text-rose-500",
};

// Shared by the input and its highlight mirror so the glyphs line up exactly.
const TEXT_CLASSES = "w-full py-4 text-3xl font-black whitespace-pre";

export default function CognitionWindowScreen() {
  const inputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [raw, setRaw] = useState("");

  // The input scrolls horizontally once text overflows; keep the mirror in step.
  const syncScroll = () => {
    if (mirrorRef.current && inputRef.current)
      mirrorRef.current.scrollLeft = inputRef.current.scrollLeft;
  };
  useEffect(syncScroll, [raw]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // The window is hidden, not destroyed, so autoFocus only fires once.
  // Refocus the input every time the shortcut brings the window back.
  useEffect(() => {
    const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) inputRef.current?.focus();
    });
    return () => void unlisten.then((fn) => fn());
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // adds the same task syntax
    const parsed = parseTaskChatInput(raw);
    const title = parsed.title.trim();
    if (!title) return;

    const when = parsed.dueDate ?? new Date();
    const block =
      parsed.block ?? getActiveBlockNameAt(when.getHours() * 60 + when.getMinutes());

    await useTasksStore.persist.rehydrate();
    useTasksStore.getState().addTask({
      title,
      ...(parsed.priority ? { priority: parsed.priority } : {}),
      ...(parsed.critical ? { critical: true } : {}),
      ...(block ? { block } : {}),
      ...(parsed.category ? { category: parsed.category } : {}),
      ...(parsed.tags ? { tags: parsed.tags } : {}),
      ...(parsed.dueDate ? { dueDate: parsed.dueDate } : {}),
      ...(parsed.endDate ? { endDate: parsed.endDate } : {}),
    });

    setRaw("");
    hide();
  };

  return (
    <motion.div
      data-tauri-drag-region
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1 }}

      className="h-full w-full items-center flex flex-row overflow-hidden rounded-3xl  px-12   bg-surface/20 backdrop-blur-2xl"
    >

      <form onSubmit={onSubmit} className="flex w-full relative items-center flex-row">
      <div
        ref={mirrorRef}
        aria-hidden
        className={`${TEXT_CLASSES} pointer-events-none absolute inset-0 overflow-hidden text-white`}
      >
        {segmentTaskInput(raw).map((seg, i) => (
          <span key={i} className={seg.kind ? TOKEN_COLORS[seg.kind] : undefined}>
            {seg.text}
          </span>
        ))}
      </div>
      <input
        ref={inputRef}
        autoFocus
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onScroll={syncScroll}
        onSelect={syncScroll}
        placeholder="What will you conjure up?"
        className={`${TEXT_CLASSES} relative bg-transparent text-transparent caret-white outline-none placeholder:font-display placeholder:text-faint`}
        />
        <button
          type="submit"
          disabled={!raw.trim()}
          className="absolute right-0 hover:scale-110 hover:bg-zinc-600 duration-500 w-12 h-12 flex items-center justify-center rounded-full text-white bg-slate-600/60 text-xl disabled:opacity-40"
        >
          <Pencil02 />
        </button>
      </form>
    </motion.div>
  );
}
