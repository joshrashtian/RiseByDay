import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AddTaskPayload, ImportIcsTaskPayload, Task, UpdateTaskPayload } from "@/types";
import {
  normalizeTaskTags,
  parseTaskKind,
  parseTaskRecurrence,
} from "../types/task";
import { normalizeTaskBlock } from "../lib/taskBlocks";
import { advanceRecurrenceDate } from "../lib/taskDates";
import { isIcsTask } from "../lib/icsTasks";
import { playTaskSound } from "../lib/taskClickSounds";
import { collectDescendantIds } from "../lib/subtasks";

import { migrateLocalStorageKey } from "@/lib/storageMigration";

const STORAGE_KEY = "risebyday-tasks";
migrateLocalStorageKey("daybyday-tasks", STORAGE_KEY);

type LegacyCategory = { id: string; name: string };

type TasksState = {
  tasks: Task[];
  /** Ids removed locally but not yet pushed as tombstones to Supabase. */
  pendingDeletedIds: string[];
  /** Ids created locally (addTask / duplicateTask) and not yet sent to the
   * API's create endpoint. Sync POSTs these instead of upserting them. */
  pendingCreateIds: string[];
  /** ISO timestamp of the last successful Supabase pull. */
  lastPulledAt: string | null;
  /** Account the local tasks and sync cursors belong to; null until the first
   * sync (or for data persisted before this was tracked). */
  syncedUserId: string | null;
  addTask: (payload: AddTaskPayload) => void;
  /** Nests a new task under `parentId`. Returns the new id, or undefined when
   * the title is empty or the parent can't take subtasks. */
  addSubtask: (parentId: string, title: string) => string | undefined;
  updateTask: (taskId: string, payload: UpdateTaskPayload) => void;
  setTaskSchedule: (taskId: string, dueDate: Date, endDate?: Date) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  duplicateTask: (id: string) => void;
  setTaskCategory: (taskId: string, category: string | undefined) => void;
  removeCategoryFromAllTasks: (categoryName: string) => void;
  setTaskBlock: (taskId: string, block: string | undefined) => void;
  setTaskTags: (taskId: string, tags: string[] | undefined) => void;
  setTaskTitle: (taskId: string, title: string) => void;
  importIcsTasks: (
    payloads: ImportIcsTaskPayload[],
  ) => { imported: number; skipped: number };
  removeAllIcsTasks: () => number;
  clearPendingDeletedIds: (ids: string[]) => void;
  clearPendingCreateIds: (ids: string[]) => void;
  setLastPulledAt: (iso: string) => void;
  setSyncedUserId: (userId: string) => void;
  /** Drops local tasks and sync state so `userId` starts from a fresh pull. */
  resetForAccount: (userId: string) => void;
  upsertFromRemote: (task: Task) => void;
  removeFromRemote: (id: string) => void;
};

function reviveTask(raw: Record<string, unknown>): Task {
  const {
    categoryId: _legacyId,
    createdAt,
    updatedAt,
    dueDate,
    endDate,
    lastCompletedAt,
    block: rawBlock,
    context: rawLegacyContext,
    category,
    tags: rawTags,
    metadata: rawMetadata,
    classLocation: rawClassLocation,
    classGrade: rawClassGrade,
    // Pre-parentId builds stored subtasks as a list on the parent; nothing
    // ever wrote to it, so it is dropped rather than migrated.
    children_tasks: _legacyChildren,
    parentId: _rawParentId,
    ...rest
  } = raw as Record<string, unknown>;

  const recurrence = parseTaskRecurrence(
    (raw as Record<string, unknown>).recurrence,
  );
  const kind =
    parseTaskKind((raw as Record<string, unknown>).kind) ??
    parseTaskKind((raw as Record<string, unknown>).type) ??
    "task";

  const tags = normalizeTaskTags(rawTags);
  const block = normalizeTaskBlock(
    typeof rawBlock === "string" ? rawBlock : rawLegacyContext,
  );

  const metadataClassRaw =
    rawMetadata &&
    typeof rawMetadata === "object" &&
    (rawMetadata as Record<string, unknown>).class &&
    typeof (rawMetadata as Record<string, unknown>).class === "object"
      ? ((rawMetadata as Record<string, unknown>).class as Record<
          string,
          unknown
        >)
      : undefined;

  const classLocationFromMetadata =
    typeof metadataClassRaw?.location === "string"
      ? metadataClassRaw.location.trim()
      : "";
  const classGradeFromMetadata =
    typeof metadataClassRaw?.grade === "string"
      ? metadataClassRaw.grade.trim()
      : "";
  const classLocationLegacy =
    typeof rawClassLocation === "string" ? rawClassLocation.trim() : "";
  const classGradeLegacy =
    typeof rawClassGrade === "string" ? rawClassGrade.trim() : "";
  const classLocation = classLocationFromMetadata || classLocationLegacy;
  const classGrade = classGradeFromMetadata || classGradeLegacy;
  const icsUidRaw = (raw as Record<string, unknown>).icsUid;
  const icsUid =
    typeof icsUidRaw === "string" && icsUidRaw.trim()
      ? icsUidRaw.trim()
      : undefined;
  const metadata =
    classLocation || classGrade
      ? {
          class: {
            ...(classLocation ? { location: classLocation } : {}),
            ...(classGrade ? { grade: classGrade } : {}),
          },
        }
      : undefined;

  const parentIdRaw = (raw as Record<string, unknown>).parentId;
  const parentId =
    typeof parentIdRaw === "string" && parentIdRaw ? parentIdRaw : undefined;

  const task: Task = {
    ...(rest as Omit<
      Task,
      | "createdAt"
      | "updatedAt"
      | "dueDate"
      | "endDate"
      | "category"
      | "recurrence"
      | "tags"
      | "lastCompletedAt"
      | "kind"
    >),
    kind,
    createdAt: new Date(String(createdAt)),
    updatedAt: new Date(String(updatedAt)),
    ...(dueDate != null && dueDate !== ""
      ? { dueDate: new Date(String(dueDate)) }
      : {}),
    ...(endDate != null && endDate !== ""
      ? { endDate: new Date(String(endDate)) }
      : {}),
    ...(lastCompletedAt != null && lastCompletedAt !== ""
      ? { lastCompletedAt: new Date(String(lastCompletedAt)) }
      : {}),
    ...(typeof category === "string" && category.trim()
      ? { category: category.trim() }
      : {}),
    ...(metadata ? { metadata } : {}),
    ...(block ? { block } : {}),
    ...(tags ? { tags } : {}),
    ...(recurrence ? { recurrence } : {}),
    ...(icsUid ? { icsUid } : {}),
    ...(parentId ? { parentId } : {}),
  };
  return task;
}


function mergePersistedTasks(
  rawTasks: unknown[],
  legacyCategories: LegacyCategory[] | undefined,
): Task[] {
  const idToName = new Map(
    (legacyCategories ?? []).map((c) => [c.id, c.name.trim()]),
  );
  return rawTasks.map((item) => {
    const raw = item as Record<string, unknown>;
    const task = reviveTask(raw);
    if (!task.category && raw.categoryId != null && raw.categoryId !== "") {
      const name = idToName.get(String(raw.categoryId));
      if (name) return { ...task, category: name };
    }
    return task;
  });
}

export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      tasks: [],
      pendingDeletedIds: [],
      pendingCreateIds: [],
      lastPulledAt: null,
      syncedUserId: null,

      setTaskCategory: (taskId, category) =>
        set((s) => {
          const existing = s.tasks.find((t) => t.id === taskId);
          if (existing && isIcsTask(existing)) return s;
          return {
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  category:
                    category == null || category === ""
                      ? undefined
                      : category,
                  updatedAt: new Date(),
                }
              : t,
          ),
        };
        }),

      removeCategoryFromAllTasks: (categoryName) =>
        set((s) => {
          const key = categoryName.trim().toLowerCase();
          if (!key) return s;
          return {
            tasks: s.tasks.map((t) => {
              const taskCategory = t.category?.trim().toLowerCase();
              if (!taskCategory || taskCategory !== key) return t;
              return { ...t, category: undefined, updatedAt: new Date() };
            }),
          };
        }),

      setTaskBlock: (taskId, block) =>
        set((s) => {
          const existing = s.tasks.find((t) => t.id === taskId);
          if (existing && isIcsTask(existing)) return s;
          return {
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  block: normalizeTaskBlock(block),
                  updatedAt: new Date(),
                }
              : t,
          ),
        };
        }),

      setTaskTags: (taskId, tags) =>
        set((s) => {
          const existing = s.tasks.find((t) => t.id === taskId);
          if (existing && isIcsTask(existing)) return s;
          return {
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  tags: normalizeTaskTags(tags ?? []),
                  updatedAt: new Date(),
                }
              : t,
          ),
        };
        }),

      setTaskTitle: (taskId, title) =>
        set((s) => {
          const trimmed = title.trim();
          const existing = s.tasks.find((t) => t.id === taskId);
          if (!trimmed || !existing || isIcsTask(existing)) return s;
          return {
            tasks: s.tasks.map((t) =>
              t.id === taskId
                ? { ...t, title: trimmed, updatedAt: new Date() }
                : t,
            ),
          };
        }),

      addTask: (payload) => {
        const trimmed = payload.title.trim();
        if (!trimmed) return;
        playTaskSound("create");
        const now = new Date();
        const cat = payload.category?.trim() || undefined;
        const classLocation =
          payload.metadata?.class?.location?.trim() ||
          payload.classLocation?.trim() ||
          undefined;
        const classGrade =
          payload.metadata?.class?.grade?.trim() ||
          payload.classGrade?.trim() ||
          undefined;
        const metadata =
          classLocation || classGrade
            ? {
                class: {
                  ...(classLocation ? { location: classLocation } : {}),
                  ...(classGrade ? { grade: classGrade } : {}),
                },
              }
            : undefined;
        const block = normalizeTaskBlock(payload.block ?? payload.context);
        const description = payload.description?.trim() || undefined;
        const notes = payload.notes?.trim() || undefined;
        const recurrence =
          payload.dueDate && payload.recurrence
            ? {
                frequency: payload.recurrence.frequency,
                interval: Math.max(1, payload.recurrence.interval ?? 1),
                ...(payload.recurrence.weekdays?.length
                  ? { weekdays: payload.recurrence.weekdays }
                  : {}),
                ...(payload.recurrence.untilDate
                  ? { untilDate: payload.recurrence.untilDate }
                  : {}),
              }
            : undefined;
        const tags = normalizeTaskTags(payload.tags ?? null);
        const id = crypto.randomUUID();
        set((s) => ({
          pendingCreateIds: [...s.pendingCreateIds, id],
          tasks: [
            ...s.tasks,
            {
              id,
              kind: payload.kind ?? "task",
              title: trimmed,
              done: false,
              createdAt: now,
              updatedAt: now,
              ...(payload.dueDate ? { dueDate: payload.dueDate } : {}),
              ...(payload.endDate ? { endDate: payload.endDate } : {}),
              ...(payload.priority ? { priority: payload.priority } : {}),
              ...(payload.critical ? { critical: true } : {}),
              ...(block ? { block } : {}),
              ...(cat ? { category: cat } : {}),
              ...(description ? { description } : {}),
              ...(notes ? { notes } : {}),
              ...(metadata ? { metadata } : {}),
              ...(classLocation ? { classLocation } : {}),
              ...(classGrade ? { classGrade } : {}),
              ...(tags ? { tags } : {}),
              ...(recurrence ? { recurrence } : {}),
            },
          ],
        }));
      },

      addSubtask: (parentId, title) => {
        const trimmed = title.trim();
        if (!trimmed) return undefined;
        const parent = get().tasks.find((t) => t.id === parentId);
        // One level deep for now: a subtask can't have its own subtasks.
        if (!parent || isIcsTask(parent) || parent.parentId) return undefined;
        playTaskSound("create");
        const now = new Date();
        const id = crypto.randomUUID();
        set((s) => ({
          pendingCreateIds: [...s.pendingCreateIds, id],
          tasks: [
            ...s.tasks,
            {
              id,
              kind: "task",
              title: trimmed,
              done: false,
              createdAt: now,
              updatedAt: now,
              parentId,
            },
          ],
        }));
        return id;
      },

      updateTask: (taskId, payload) =>
        set((s) => {
          const existing = s.tasks.find((t) => t.id === taskId);
          if (existing && isIcsTask(existing)) return s;
          const title = payload.title.trim();
          if (!title) return s;
          const block = normalizeTaskBlock(payload.block);
          const category = payload.category?.trim() || undefined;
          const description = payload.description?.trim() || undefined;
          const notes = payload.notes?.trim() || undefined;
          const classLocation =
            payload.metadata?.class?.location?.trim() ||
            payload.classLocation?.trim() ||
            undefined;
          const classGrade =
            payload.metadata?.class?.grade?.trim() ||
            payload.classGrade?.trim() ||
            undefined;
          const metadata =
            classLocation || classGrade
              ? {
                  class: {
                    ...(classLocation ? { location: classLocation } : {}),
                    ...(classGrade ? { grade: classGrade } : {}),
                  },
                }
              : undefined;
          const tags = normalizeTaskTags(payload.tags ?? []);
          const dueDate = payload.dueDate;
          const endDate =
            dueDate && payload.endDate && payload.endDate >= dueDate
              ? payload.endDate
              : undefined;
          const recurrence =
            dueDate && payload.recurrence
              ? {
                  frequency: payload.recurrence.frequency,
                  interval: Math.max(1, payload.recurrence.interval ?? 1),
                  ...(payload.recurrence.weekdays?.length
                    ? { weekdays: payload.recurrence.weekdays }
                    : {}),
                  ...(payload.recurrence.untilDate
                    ? { untilDate: payload.recurrence.untilDate }
                    : {}),
                }
              : undefined;

          return {
            tasks: s.tasks.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    kind: payload.kind ?? t.kind ?? "task",
                    title,
                    dueDate,
                    endDate,
                    priority: payload.priority,
                    critical: payload.critical ? true : undefined,
                    block,
                    category,
                    description,
                    notes,
                    metadata,
                    classLocation,
                    classGrade,
                    tags,
                    recurrence,
                    updatedAt: new Date(),
                  }
                : t,
            ),
          };
        }),

      setTaskSchedule: (taskId, dueDate, endDate) =>
        set((s) => {
          const existing = s.tasks.find((t) => t.id === taskId);
          if (existing && isIcsTask(existing)) return s;
          return {
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  dueDate,
                  endDate,
                  updatedAt: new Date(),
                }
              : t,
          ),
        };
        }),

      toggleTask: (id) => {
        const task = get().tasks.find((t) => t.id === id);
        if (task && !isIcsTask(task)) {
          playTaskSound(task.done ? "uncheck" : "complete");
        }
        set((s) => {
          const task = s.tasks.find((t) => t.id === id);
          if (!task) return s;
          if (isIcsTask(task)) return s;
          const now = new Date();
          if (!task.done && task.recurrence && task.dueDate) {
            const durationMs = task.endDate
              ? task.endDate.getTime() - task.dueDate.getTime()
              : undefined;
            const nextDue = advanceRecurrenceDate(task.dueDate, task.recurrence);
            const recursAgain =
              !task.recurrence.untilDate ||
              nextDue.getTime() <= task.recurrence.untilDate.getTime();
            if (!recursAgain) {
              return {
                tasks: s.tasks.map((t) =>
                  t.id === id
                    ? {
                        ...t,
                        done: true,
                        lastCompletedAt: now,
                        updatedAt: now,
                      }
                    : t,
                ),
              };
            }

            const sourceId = task.recurringSourceId ?? task.id;
            // The next occurrence starts with a fresh checklist.
            const subtaskIds = new Set(collectDescendantIds(s.tasks, id));
            const completedOccurrence: Task = {
              ...task,
              id: crypto.randomUUID(),
              done: true,
              recurrence: undefined,
              recurringSourceId: sourceId,
              lastCompletedAt: now,
              updatedAt: now,
            };

            return {
              tasks: [
                ...s.tasks.map((t) => {
                  if (t.id === id) {
                    return {
                      ...t,
                      done: false,
                      dueDate: nextDue,
                      ...(durationMs != null
                        ? { endDate: new Date(nextDue.getTime() + durationMs) }
                        : {}),
                      recurringSourceId: sourceId,
                      updatedAt: now,
                    };
                  }
                  if (subtaskIds.has(t.id) && t.done) {
                    return { ...t, done: false, updatedAt: now };
                  }
                  return t;
                }),
                completedOccurrence,
              ],
            };
          }
          // Checking off a parent checks off whatever is left under it;
          // un-checking it leaves the subtasks as they were.
          const completing = !task.done;
          const subtaskIds = completing
            ? new Set(collectDescendantIds(s.tasks, id))
            : new Set<string>();
          return {
            tasks: s.tasks.map((t) => {
              if (t.id === id) return { ...t, done: !t.done, updatedAt: now };
              if (subtaskIds.has(t.id) && !t.done) {
                return { ...t, done: true, updatedAt: now };
              }
              return t;
            }),
          };
        });
      },

      removeTask: (id) =>
        set((s) => {
          // Deletes are soft, so the parent_id FK's ON DELETE CASCADE never
          // fires; subtasks need their own tombstones.
          const removed = new Set([id, ...collectDescendantIds(s.tasks, id)]);
          const pendingDeletedIds = new Set(s.pendingDeletedIds);
          for (const removedId of removed) pendingDeletedIds.add(removedId);
          return {
            tasks: s.tasks.filter((t) => !removed.has(t.id)),
            pendingCreateIds: s.pendingCreateIds.filter(
              (pid) => !removed.has(pid),
            ),
            pendingDeletedIds: [...pendingDeletedIds],
          };
        }),

      duplicateTask: (id) =>
        set((s) => {
          const index = s.tasks.findIndex((t) => t.id === id);
          if (index === -1) return s;
          const original = s.tasks[index];
          if (isIcsTask(original)) return s;
          const now = new Date();
          const { icsUid: _icsUid, recurringSourceId: _recurringSourceId, ...rest } =
            original;
          const clone: Task = {
            ...rest,
            id: crypto.randomUUID(),
            done: false,
            createdAt: now,
            updatedAt: now,
            lastCompletedAt: undefined,
          };
          // Subtasks come along, unchecked, under the copy. Created after the
          // clone so pending creates reach the server parent-first.
          const subtaskClones: Task[] = s.tasks
            .filter((t) => t.parentId === id)
            .map((t) => ({
              ...t,
              id: crypto.randomUUID(),
              parentId: clone.id,
              done: false,
              createdAt: new Date(t.createdAt.getTime()),
              updatedAt: now,
              lastCompletedAt: undefined,
            }));
          const tasks = [...s.tasks, ...subtaskClones];
          tasks.splice(index + 1, 0, clone);
          return {
            tasks,
            pendingCreateIds: [
              ...s.pendingCreateIds,
              clone.id,
              ...subtaskClones.map((t) => t.id),
            ],
          };
        }),

      importIcsTasks: (payloads) => {
        const s = get();
        const existingUids = new Set(
          s.tasks.flatMap((task) => (task.icsUid ? [task.icsUid] : [])),
        );
        const now = new Date();
        const additions: Task[] = [];
        let imported = 0;
        let skipped = 0;

        for (const payload of payloads) {
          const title = payload.title.trim();
          if (!title) {
            skipped += 1;
            continue;
          }
          if (existingUids.has(payload.icsUid)) {
            skipped += 1;
            continue;
          }

          existingUids.add(payload.icsUid);
          imported += 1;
          const classLocation = payload.classLocation?.trim() || undefined;
          const category = payload.category?.trim() || undefined;
          const description = payload.description?.trim() || undefined;

          additions.push({
            id: crypto.randomUUID(),
            kind: "ics",
            title,
            done: false,
            createdAt: now,
            updatedAt: now,
            dueDate: payload.dueDate,
            ...(payload.endDate ? { endDate: payload.endDate } : {}),
            ...(category ? { category } : {}),
            ...(description ? { description } : {}),
            ...(classLocation
              ? {
                  classLocation,
                  metadata: { class: { location: classLocation } },
                }
              : {}),
            icsUid: payload.icsUid,
          });
        }

        if (additions.length > 0) {
          set({ tasks: [...s.tasks, ...additions] });
        }

        return { imported, skipped };
      },

      removeAllIcsTasks: () => {
        const s = get();
        const remaining = s.tasks.filter((task) => !isIcsTask(task));
        const removed = s.tasks.length - remaining.length;
        if (removed === 0) return 0;

        // Bulk removals need tombstones too, or sync leaves the rows live in
        // Postgres and a fresh sign-in pulls every one of them back.
        const pendingDeletedIds = new Set(s.pendingDeletedIds);
        for (const task of s.tasks) {
          if (isIcsTask(task)) pendingDeletedIds.add(task.id);
        }

        set({ tasks: remaining, pendingDeletedIds: [...pendingDeletedIds] });
        return removed;
      },

      clearPendingDeletedIds: (ids) =>
        set((s) => ({
          pendingDeletedIds: s.pendingDeletedIds.filter(
            (id) => !ids.includes(id),
          ),
        })),

      clearPendingCreateIds: (ids) =>
        set((s) => ({
          pendingCreateIds: s.pendingCreateIds.filter((id) => !ids.includes(id)),
        })),

      setLastPulledAt: (iso) => set({ lastPulledAt: iso }),

      setSyncedUserId: (userId) => set({ syncedUserId: userId }),

      resetForAccount: (userId) =>
        set({
          tasks: [],
          pendingDeletedIds: [],
          pendingCreateIds: [],
          lastPulledAt: null,
          syncedUserId: userId,
        }),

      upsertFromRemote: (task) =>
        set((s) => {
          // An event imported on two devices (or before the first pull) gets a
          // different id on each; the server's copy wins so only one survives.
          const tasks = task.icsUid
            ? s.tasks.filter((t) => t.id === task.id || t.icsUid !== task.icsUid)
            : [...s.tasks];
          const index = tasks.findIndex((t) => t.id === task.id);
          if (index === -1) return { tasks: [...tasks, task] };
          tasks[index] = task;
          return { tasks };
        }),

      removeFromRemote: (id) =>
        set((s) => {
          // The other device tombstones subtasks too, but drop them now so a
          // pull that lands mid-way never leaves orphans on screen.
          const removed = new Set([id, ...collectDescendantIds(s.tasks, id)]);
          return { tasks: s.tasks.filter((t) => !removed.has(t.id)) };
        }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        tasks: state.tasks,
        pendingDeletedIds: state.pendingDeletedIds,
        pendingCreateIds: state.pendingCreateIds,
        lastPulledAt: state.lastPulledAt,
        syncedUserId: state.syncedUserId,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<{
          tasks: unknown[];
          categories: LegacyCategory[];
          pendingDeletedIds: string[];
          pendingCreateIds: string[];
          lastPulledAt: string | null;
          syncedUserId: string | null;
        }>;
        const base = current as TasksState;
        const rawTasks = p?.tasks;
        const legacyCats = p?.categories;
        return {
          ...base,
          tasks: Array.isArray(rawTasks)
            ? mergePersistedTasks(rawTasks, legacyCats)
            : base.tasks,
          pendingDeletedIds: Array.isArray(p?.pendingDeletedIds)
            ? p.pendingDeletedIds
            : base.pendingDeletedIds,
          pendingCreateIds: Array.isArray(p?.pendingCreateIds)
            ? p.pendingCreateIds
            : base.pendingCreateIds,
          lastPulledAt: typeof p?.lastPulledAt === "string" ? p.lastPulledAt : null,
          syncedUserId: typeof p?.syncedUserId === "string" ? p.syncedUserId : null,
        };
      },
    },
  ),
);

// Other windows (e.g. the cognition quick-add bar) write to the same
// localStorage key; reload so this window shows their tasks and doesn't
// overwrite them with a stale copy on its next save.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      void useTasksStore.persist.rehydrate();
    }
  });
}

export const useTasks = useTasksStore;
