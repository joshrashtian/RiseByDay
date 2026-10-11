import { useEffect, useRef, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion } from "motion/react";
import { Pencil01, Pencil02 } from "@untitledui/icons";
import { parseTaskChatInput } from "../components/tasks/functions/parseTokens";
import { getActiveBlockNameAt } from "../lib/taskBlocks";
import { useTasksStore } from "../stores/tasksStore";

const hide = () => void invoke("hide_cognition_bar");

export default function CognitionWindowScreen() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState("");

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
      <input
        ref={inputRef}
        autoFocus
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="What will you conjure up?"
        className=" bg-transparent w-full font-black  placeholder:font-display py-4 text-3xl  text-white outline-none placeholder:text-faint"
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
