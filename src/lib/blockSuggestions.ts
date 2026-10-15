/** Built-in block names. Pure (no store) so the task parser can import it standalone. */

export const TIME_BLOCK_SUGGESTIONS = [
  "Early Morning",
  "Morning",
  "Afternoon",
  "Evening",
  "Late Night",
] as const;

export const CONTEXT_BLOCK_SUGGESTIONS = [
  "Work",
  "School",
  "Home",
  "Fitness",
  "Errands",
] as const;

export const DEFAULT_BLOCK_SUGGESTIONS = [
  ...TIME_BLOCK_SUGGESTIONS,
  ...CONTEXT_BLOCK_SUGGESTIONS,
] as const;
