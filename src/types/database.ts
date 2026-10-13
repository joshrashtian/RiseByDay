// ---------------------------------------------------------------------------
// RiseByDay – Supabase schema types
//
// Hand-maintained mirror of supabase/migrations/*.sql. Pure types: no runtime,
// no React, no Supabase import. Drop this file (together with `./index.ts`,
// which it imports the domain types from) into a CLI or React Native project
// to get the same typed client:
//
//   import { createClient } from "@supabase/supabase-js";
//   import type { Database } from "./database";
//   export const supabase = createClient<Database>(url, key);
//
// Rows use snake_case and ISO-8601 strings, exactly what PostgREST returns.
// `src/lib/cloud/mappers.ts` converts between these and the domain types.
//
// Regenerating instead of hand-editing:
//   supabase gen types typescript --project-id <ref> > src/types/database.ts
// (you lose the hand-written JSON column shapes below if you do)
// ---------------------------------------------------------------------------

import type {
  AudioPrefs,
  ManualWeatherCoords,
  RecurrenceFrequency,
  RecurrenceWeekday,
  TaskKind,
  TaskMetadata,
  TaskPriority,
} from "./index";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** ISO-8601 timestamp string, e.g. "2026-09-03T17:04:00.000Z". */
export type IsoTimestamp = string;

// ── JSON column shapes ────────────────────────────────────────────────────

/** `tasks.recurrence`. Same as `TaskRecurrence` but `untilDate` is an ISO string. */
export type TaskRecurrenceJson = {
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays?: RecurrenceWeekday[] | null;
  untilDate?: IsoTimestamp | null;
};

/** `user_settings.sidebar`. */
export type SidebarSettingsJson = {
  open: boolean;
  width: number;
  mode: "tasks" | "social" | "apps";
  taskOrder: string[];
  socialOrder: string[];
  appOrder: string[];
};

export type AudioPrefsJson = AudioPrefs;
export type WeatherCoordsJson = ManualWeatherCoords;

// ── Enums ─────────────────────────────────────────────────────────────────

export type TaskKindEnum = TaskKind;
export type TaskPriorityEnum = TaskPriority;
export type CalendarProviderEnum = "google";
export type ThemePreferenceValue = "light" | "dark" | "system";

// ── Rows ──────────────────────────────────────────────────────────────────

export type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
};

export type TaskRow = {
  id: string;
  user_id: string;
  kind: TaskKindEnum;
  title: string;
  done: boolean;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
  due_date: IsoTimestamp | null;
  end_date: IsoTimestamp | null;
  priority: TaskPriorityEnum | null;
  critical: boolean | null;
  block: string | null;
  category: string | null;
  description: string | null;
  notes: string | null;
  tags: string[] | null;
  metadata: TaskMetadata | null;
  recurrence: TaskRecurrenceJson | null;
  last_completed_at: IsoTimestamp | null;
  recurring_source_id: string | null;
  ics_uid: string | null;
  parent_id: string | null;
  /** Soft-delete tombstone. Non-null rows are deletes to apply locally. */
  deleted_at: IsoTimestamp | null;
};

export type UserBlockRow = {
  id: string;
  user_id: string;
  name: string;
  start_minutes: number;
  end_minutes: number;
  color: string | null;
  icon: string | null;
  sort_order: number;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
};

export type UserCategoryRow = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string | null;
  sort_order: number;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
};

export type CustomSoundRow = {
  id: string;
  user_id: string;
  name: string;
  mime_type: string;
  data_url: string | null;
  storage_path: string | null;
  created_at: IsoTimestamp;
};

export type UserSettingsRow = {
  user_id: string;
  theme: ThemePreferenceValue;
  day_transition_enabled: boolean;
  zoom_level: number;
  sidebar: SidebarSettingsJson;
  pinned_toolkit_panels: string[];
  weather_coords: WeatherCoordsJson | null;
  audio_prefs: AudioPrefsJson;
  calendar_import_past_months: number;
  calendar_import_future_months: number;
  ics_last_import_at: IsoTimestamp | null;
  ics_last_import_count: number | null;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
};

export type CalendarConnectionRow = {
  id: string;
  user_id: string;
  provider: CalendarProviderEnum;
  connected: boolean;
  account_email: string | null;
  last_import_at: IsoTimestamp | null;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
};

export type CalendarSourceRow = {
  id: string;
  user_id: string;
  connection_id: string;
  external_id: string;
  name: string;
  color: string | null;
  enabled: boolean;
  sort_order: number;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
};

/** `pomodoro_sessions`. `end_time` is null while the session is in progress. */
export type PomodoroSessionRow = {
  id: string;
  user_id: string;
  created_at: IsoTimestamp;
  start_time: IsoTimestamp;
  end_time: IsoTimestamp | null;
  focused_task_id: string | null;
};

/** `follows`. One row per one-way follow; written through the API. */
export type FollowRow = {
  follower_id: string;
  following_id: string;
  created_at: IsoTimestamp;
};

// ── Insert / Update shapes ────────────────────────────────────────────────
// Columns with a database default are optional on insert; `user_id` defaults
// to auth.uid(), so it can be omitted when the caller is the owner.

type Defaulted<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type ProfileInsert = Defaulted<
  ProfileRow,
  | "email"
  | "display_name"
  | "full_name"
  | "avatar_url"
  | "username"
  | "created_at"
  | "updated_at"
>;

export type TaskInsert = Defaulted<
  TaskRow,
  Exclude<keyof TaskRow, "id">
> & { id: string };

export type UserBlockInsert = Defaulted<
  UserBlockRow,
  "id" | "user_id" | "color" | "icon" | "sort_order" | "created_at" | "updated_at"
>;

export type UserCategoryInsert = Defaulted<
  UserCategoryRow,
  "id" | "user_id" | "color" | "icon" | "sort_order" | "created_at" | "updated_at"
>;

export type CustomSoundInsert = Defaulted<
  CustomSoundRow,
  "id" | "user_id" | "data_url" | "storage_path" | "created_at"
>;

export type UserSettingsInsert = Defaulted<
  UserSettingsRow,
  Exclude<keyof UserSettingsRow, "user_id">
> & { user_id?: string };

export type CalendarConnectionInsert = Defaulted<
  CalendarConnectionRow,
  | "id"
  | "user_id"
  | "connected"
  | "account_email"
  | "last_import_at"
  | "created_at"
  | "updated_at"
>;

export type CalendarSourceInsert = Defaulted<
  CalendarSourceRow,
  "id" | "user_id" | "color" | "enabled" | "sort_order" | "created_at" | "updated_at"
>;

export type PomodoroSessionInsert = Defaulted<
  PomodoroSessionRow,
  "id" | "user_id" | "created_at" | "end_time" | "focused_task_id"
>;

export type FollowInsert = Defaulted<FollowRow, "follower_id" | "created_at">;

// ── Database (for createClient<Database>) ─────────────────────────────────

type TableDef<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow, ProfileInsert>;
      tasks: TableDef<TaskRow, TaskInsert>;
      user_blocks: TableDef<UserBlockRow, UserBlockInsert>;
      user_categories: TableDef<UserCategoryRow, UserCategoryInsert>;
      custom_sounds: TableDef<CustomSoundRow, CustomSoundInsert>;
      user_settings: TableDef<UserSettingsRow, UserSettingsInsert>;
      calendar_connections: TableDef<
        CalendarConnectionRow,
        CalendarConnectionInsert
      >;
      calendar_sources: TableDef<CalendarSourceRow, CalendarSourceInsert>;
      pomodoro_sessions: TableDef<PomodoroSessionRow, PomodoroSessionInsert>;
      follows: TableDef<FollowRow, FollowInsert>;
    };
    Views: {
      /** `tasks` filtered to `deleted_at is null`. Read-only. */
      active_tasks: { Row: TaskRow; Relationships: [] };
    };
    Functions: Record<string, never>;
    Enums: {
      task_kind: TaskKindEnum;
      task_priority: TaskPriorityEnum;
      calendar_provider: CalendarProviderEnum;
    };
    CompositeTypes: Record<string, never>;
  };
};

/** Table name → Row, for generic helpers. */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
