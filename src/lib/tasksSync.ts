import { create } from "zustand";
import { isAxiosError } from "axios";
import { api } from "@/api";
import { supabase } from "@/utils/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useTasksStore } from "@/stores/tasksStore";
import { rowToTask, taskToRow, taskTombstoneRow } from "@/lib/cloud/mappers";
import { syncCategories } from "@/lib/categoriesSync";
import { syncBlocks } from "@/lib/blocksSync";
import type { TaskRow } from "@/types/database";
import type { Task } from "@/types";

type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";

const useSyncStatusStore = create<{ status: SyncStatus }>(() => ({
  status: "idle",
}));

export function useSyncStatus() {
  return useSyncStatusStore((s) => s.status);
}

function setStatus(status: SyncStatus) {
  useSyncStatusStore.setState({ status });
}

let isSyncing = false;
/** Set when syncNow() is called mid-sync, so changes made during it (a new
 * task, say) go out right after instead of waiting for the next interval. */
let rerunRequested = false;
/** Epoch ms watermark for locally-dirty tasks; module-scoped (not persisted) — a
 * restart re-pushes unchanged tasks once, which is harmless since upserts are
 * idempotent. */
let lastPushedAt = 0;

/** The create endpoint lives on the RiseByDay API; builds without
 * VITE_API_URL fall back to upserting new tasks straight into Supabase. */
const hasApi = Boolean(import.meta.env.VITE_API_URL);

/** A retry after a lost response hits the primary key — the row exists. */
function isAlreadyCreated(err: unknown) {
  if (!isAxiosError(err) || err.response?.status !== 400) return false;
  const detail = (err.response.data as { detail?: unknown } | undefined)?.detail;
  return typeof detail === "string" && detail.includes("duplicate key");
}

/** POSTs each pending create; returns the ids that still aren't on the server.
 * Goes in creation order, so a parent always lands before its subtasks — the
 * parent_id foreign key would reject them otherwise. */
async function pushPendingCreates(userId: string): Promise<Set<string>> {
  const { tasks, pendingCreateIds } = useTasksStore.getState();
  const failed = new Set<string>();
  const done: string[] = [];

  for (const id of pendingCreateIds) {
    const task = tasks.find((t) => t.id === id);
    if (!task) {
      done.push(id);
      continue;
    }
    if (task.parentId && failed.has(task.parentId)) {
      failed.add(id);
      continue;
    }
    try {
      await api.post("/tasksapi/tasks/create", taskToRow(task, userId));
      done.push(id);
    } catch (err) {
      if (isAlreadyCreated(err)) {
        done.push(id);
      } else {
        console.error(`Task create failed for ${id}`, err);
        failed.add(id);
      }
    }
  }

  useTasksStore.getState().clearPendingCreateIds(done);
  return failed;
}

/** Keeps `.in()` filters well under PostgREST's URL length limit. */
const ICS_LOOKUP_CHUNK = 100;

/** ICS imports dedupe against local tasks only, so an event already on the
 * server under another id (imported on another device, or before this one's
 * first pull) would be inserted again and hit the unique index — failing the
 * whole batch on every sync. Swaps those local copies for the server's row and
 * returns the local ids that must not be pushed. */
async function adoptRemoteIcsDuplicates(
  userId: string,
  icsTasks: Task[],
): Promise<Set<string>> {
  const superseded = new Set<string>();
  const byUid = new Map(icsTasks.map((t) => [t.icsUid!, t]));
  const uids = [...byUid.keys()];

  for (let i = 0; i < uids.length; i += ICS_LOOKUP_CHUNK) {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .in("ics_uid", uids.slice(i, i + ICS_LOOKUP_CHUNK));
    if (error) throw error;

    for (const row of (data ?? []) as TaskRow[]) {
      const local = row.ics_uid ? byUid.get(row.ics_uid) : undefined;
      if (!local || local.id === row.id) continue;
      superseded.add(local.id);
      useTasksStore.getState().upsertFromRemote(rowToTask(row));
    }
  }

  return superseded;
}

/** Returns true when every pending create reached the API. */
async function pushLocalChanges(userId: string): Promise<boolean> {
  const state = useTasksStore.getState();
  const pushTime = Date.now();
  // New tasks go through the API; a create that failed stays pending and is
  // kept out of the upsert so it's retried as a create next sync.
  const pendingCreates = hasApi ? new Set(state.pendingCreateIds) : new Set<string>();
  const failedCreates = hasApi
    ? await pushPendingCreates(userId)
    : new Set<string>();

  // Tombstones first: removing ICS events and re-importing them before the
  // next sync would otherwise insert the new rows while the old ones are still
  // live, tripping the (user_id, ics_uid) unique index.
  const pendingDeletedIds = state.pendingDeletedIds;
  if (pendingDeletedIds.length > 0) {
    const deletedAt = new Date();
    const { error } = await supabase
      .from("tasks")
      .upsert(pendingDeletedIds.map((id) => taskTombstoneRow(id, userId, deletedAt)));
    if (error) throw error;
    useTasksStore.getState().clearPendingDeletedIds(pendingDeletedIds);
  }

  const dirty = state.tasks.filter(
    (t) =>
      t.updatedAt.getTime() > lastPushedAt &&
      !pendingCreates.has(t.id) &&
      !failedCreates.has(t.id),
  );
  const superseded = await adoptRemoteIcsDuplicates(
    userId,
    dirty.filter((t) => t.icsUid),
  );
  const toUpsert = dirty.filter((t) => !superseded.has(t.id));

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("tasks")
      .upsert(toUpsert.map((t) => taskToRow(t, userId)));
    if (error) throw error;
  }
  if (!hasApi) {
    useTasksStore.getState().clearPendingCreateIds(state.pendingCreateIds);
  }

  lastPushedAt = pushTime;
  return failedCreates.size === 0;
}

async function pullRemoteChanges(userId: string) {
  const since = useTasksStore.getState().lastPulledAt ?? new Date(0).toISOString();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .gt("updated_at", since);
  if (error) throw error;

  const pullTime = new Date().toISOString();
  const localTasks = useTasksStore.getState().tasks;

  for (const row of (data ?? []) as TaskRow[]) {
    if (row.deleted_at) {
      useTasksStore.getState().removeFromRemote(row.id);
      continue;
    }
    const local = localTasks.find((t) => t.id === row.id);
    const remoteTask = rowToTask(row);
    if (!local || remoteTask.updatedAt.getTime() > local.updatedAt.getTime()) {
      useTasksStore.getState().upsertFromRemote(remoteTask);
    }
  }

  useTasksStore.getState().setLastPulledAt(pullTime);
}

/** Local tasks belong to one account. Pushing another account's tasks under
 * this user's id would upsert rows RLS won't let us touch, failing every sync,
 * so a different account starts over from a fresh pull. Data that has never
 * synced (no owner, no pull cursor) is local-only and is adopted instead. */
function claimLocalTasksFor(userId: string) {
  const { syncedUserId, lastPulledAt, setSyncedUserId, resetForAccount } =
    useTasksStore.getState();
  if (syncedUserId === userId) return;
  if (syncedUserId === null && lastPulledAt === null) {
    setSyncedUserId(userId);
    return;
  }
  resetForAccount(userId);
  lastPushedAt = 0;
}

/** Syncs categories and blocks, then pushes local task changes to Supabase and pulls
 * remote changes down. Configs go first so tasks pulled from another device
 * arrive with the categories and blocks they reference.
 * No-ops when signed out or offline; only one sync runs at a time. */
export async function syncNow() {
  if (useAuthStore.getState().status !== "signedIn") return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setStatus("offline");
    return;
  }
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;
  if (isSyncing) {
    rerunRequested = true;
    return;
  }

  isSyncing = true;
  setStatus("syncing");
  try {
    claimLocalTasksFor(userId);
    // A config failure shouldn't hold up tasks; it's retried next sync.
    let configsSynced = true;
    for (const [label, syncConfig] of [
      ["Category", syncCategories],
      ["Block", syncBlocks],
    ] as const) {
      try {
        await syncConfig(userId);
      } catch (err) {
        console.error(`${label} sync failed`, err);
        configsSynced = false;
      }
    }
    const createsPushed = await pushLocalChanges(userId);
    await pullRemoteChanges(userId);
    setStatus(createsPushed && configsSynced ? "synced" : "error");
  } catch (err) {
    console.error("Task sync failed", err);
    setStatus("error");
  } finally {
    isSyncing = false;
  }
  if (rerunRequested) {
    rerunRequested = false;
    void syncNow();
  }
}
