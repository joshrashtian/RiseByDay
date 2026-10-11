/**
 * Build-time feature flags, read from `VITE_*` env vars. They are constants,
 * so Vite drops the gated branches from builds that leave them off.
 */

/**
 * Spotify only grants extended API quota to apps with 250k+ MAU; below that an
 * app stays in development mode, limited to hand-allowlisted users. So the
 * integration is hidden unless `VITE_ENABLE_SPOTIFY=true`.
 */
export const SPOTIFY_ENABLED = import.meta.env.VITE_ENABLE_SPOTIFY === "true";

/**
 * Google Calendar import. Until the OAuth consent screen passes Google's
 * verification (`calendar.readonly` is a sensitive scope), only listed test
 * users can sign in and their refresh tokens lapse after 7 days — so it is
 * hidden unless `VITE_ENABLE_GOOGLE_CALENDAR=true`.
 */
export const GOOGLE_CALENDAR_ENABLED =
  import.meta.env.VITE_ENABLE_GOOGLE_CALENDAR === "true";

/**
 * Projects screen. Still a stub, so its route and sidebar item are hidden
 * unless `VITE_ENABLE_PROJECTS=true`.
 */
export const PROJECTS_ENABLED = import.meta.env.VITE_ENABLE_PROJECTS === "true";
