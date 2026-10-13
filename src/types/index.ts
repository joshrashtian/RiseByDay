// ---------------------------------------------------------------------------
// RiseByDay – shared type definitions
// Copy this file into any project that needs access to the RiseByDay domain
// model. Every declaration is a pure TypeScript type (no runtime, no React).
// ---------------------------------------------------------------------------

// ── Tasks ─────────────────────────────────────────────────────────────────

export type TaskPriority = "low" | "medium" | "high";
export type TaskKind =
  "task" | "event" | "reminder" | "habit" | "class" | "ics";

export type RecurrenceFrequency = "daily" | "weekly" | "monthly";
export type RecurrenceWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type TaskRecurrence = {
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays?: RecurrenceWeekday[];
  untilDate?: Date;
};

export type TaskMetadata = {
  class?: {
    location?: string;
    grade?: string;
  };
};

export type Task = {
  id: string;
  kind: TaskKind;
  title: string;
  done: boolean;
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  endDate?: Date;
  priority?: TaskPriority;
  block?: string;
  category?: string;
  description?: string;
  tags?: string[];
  notes?: string;
  metadata?: TaskMetadata;
  classLocation?: string;
  classGrade?: string;
  critical?: boolean;
  recurrence?: TaskRecurrence;
  lastCompletedAt?: Date;
  recurringSourceId?: string;
  /** Stable UID from an imported `.ics` event — used for dedup on re-import. */
  icsUid?: string;
  /**
   * Set on subtasks: the id of the task this one is nested under. The pointer
   * lives on the child (not as a list on the parent) so attaching a subtask is
   * a write to one row, matching `tasks.parent_id` column-for-column.
   */
  parentId?: string;
};

export type ImportIcsTaskPayload = {
  title: string;
  dueDate: Date;
  endDate?: Date;
  category?: string;
  classLocation?: string;
  description?: string;
  icsUid: string;
};

export type AddTaskPayload = {
  kind?: TaskKind;
  title: string;
  dueDate?: Date;
  endDate?: Date;
  priority?: TaskPriority;
  critical?: boolean;
  block?: string;
  context?: string;
  category?: string;
  description?: string;
  notes?: string;
  metadata?: TaskMetadata;
  classLocation?: string;
  classGrade?: string;
  tags?: string[];
  recurrence?: TaskRecurrence;
};

export type UpdateTaskPayload = {
  kind?: TaskKind;
  title: string;
  dueDate?: Date;
  endDate?: Date;
  priority?: TaskPriority;
  critical?: boolean;
  block?: string;
  category?: string;
  description?: string;
  notes?: string;
  metadata?: TaskMetadata;
  classLocation?: string;
  classGrade?: string;
  tags?: string[];
  recurrence?: TaskRecurrence;
};

// ── Blocks ────────────────────────────────────────────────────────────────

export type BlockConfig = {
  name: string;
  startMinutes: number;
  endMinutes: number;
  /** Hex color (e.g. "#ee6c2b") used for the dial arc, legend, and row accent. */
  color?: string;
  /** Icon id from CATEGORY_ICON_OPTIONS. */
  icon?: string;
};

// ── Categories ────────────────────────────────────────────────────────────

export type CategoryConfig = {
  name: string;
  color: string;
  icon?: string;
};

// ── Calendar ──────────────────────────────────────────────────────────────

export type CalendarTaskRow = {
  task: Task;
  displayDueDate: Date;
  rowKey: string;
};

// ── Toolkit ───────────────────────────────────────────────────────────────

export type ToolkitPanel = {
  id: string;
  label: string;
  description: string;
  route: string;
};

// ── Weather ───────────────────────────────────────────────────────────────

export type ManualWeatherCoords = { lat: number; lon: number };

export type WeatherState =
  | { status: "loading" }
  | { status: "ok"; tempF: number; code: number }
  | { status: "error" };

// ── Calendar integrations ─────────────────────────────────────────────────

export type CalendarProvider = "google";

export type ConnectedCalendar = {
  id: string;
  provider: CalendarProvider;
  name: string;
  color?: string;
  enabled: boolean;
};

export type GoogleTokens = {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. */
  expiresAt: number;
  scope: string;
};

// ── Home ─────────────────────────────────────────────────────────────────

export type DayFocusMode = "current-block" | "all-day";

export type AudioPrefs = {
  soundEnabled: boolean;
  volume: number;
  /** Sound for checking off a task. */
  taskClickSoundId: string;
  /** Sound for un-checking a completed task. */
  taskUncheckSoundId: string;
  /** Sound for creating a task. */
  taskCreateSoundId: string;
};

export type CustomSound = {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
};

// ── Spotify ───────────────────────────────────────────────────────────────

/**
 * One finished listen. `playedAt` is Spotify's own `played_at` timestamp and is
 * the dedupe key for the local history log — Spotify has no API for querying
 * history by date, so the log is accumulated by polling rather than fetched.
 */
export type SpotifyPlay = {
  playedAt: string;
  trackId: string;
  title: string;
  artists: string;
  album: string;
  albumArtUrl?: string;
  durationMs: number;
  trackUrl?: string;
};

export type SpotifyNowPlaying = {
  trackId: string;
  title: string;
  artists: string;
  album: string;
  albumArtUrl?: string;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
  trackUrl?: string;
  
};

export type SpotifyAccount = {
  id: string;
  displayName?: string;
};

export type SpotifyTokens = {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. */
  expiresAt: number;
  scope: string;
};

// ── Color themes ────────────────────────────────────────────────────────────
// The shape of a theme JSON file (see `src/themes/`). Values must be hex,
// rgb()/rgba() or hsl()/hsla() so the same file can drive a React Native
// client — no CSS variables, gradients or url().

export type ColorThemeToken =
  | "canvas" | "surface" | "raised" | "sunken"
  | "ink" | "muted" | "faint"
  | "line" | "line-strong"
  | "accent" | "accent-hover" | "accent-soft" | "accent-ink"
  | "secondary" | "secondary-soft"
  | "danger" | "danger-soft" | "success" | "success-soft" | "warn" | "warn-soft"
  | "overlay";

/** Per-surface overrides. Each defaults to a base token in App.css. */
export type ColorThemeComponentToken =
  | "sidebar-bg" | "sidebar-ink" | "sidebar-ink-active"
  | "sidebar-item-hover" | "sidebar-item-active" | "sidebar-line"
  | "input-bg" | "input-line" | "input-focus"
  | "card-bg" | "card-line"
  | "popover-bg";

export type ColorThemeAppearance = "light" | "dark" | "both";

export type ColorThemeFile = {
  schemaVersion: 1;
  id: string;
  name: string;
  author?: string;
  version?: string;
  description?: string;
  appearance: ColorThemeAppearance;
  /** Theme id that supplies any token this file leaves out. */
  extends?: string;
  colors: {
    light?: Partial<Record<ColorThemeToken, string>>;
    dark?: Partial<Record<ColorThemeToken, string>>;
  };
  components?: {
    light?: Partial<Record<ColorThemeComponentToken, string>>;
    dark?: Partial<Record<ColorThemeComponentToken, string>>;
  };
  categoryPalette?: string[];
};
