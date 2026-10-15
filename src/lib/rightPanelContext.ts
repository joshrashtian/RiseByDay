/**
 * Maps the current route to the contextual panel the right panel shows.
 * Pure: no React, no stores — so the mapping can be unit-tested or reused.
 */

export type ContextPanelId =
  | "home"
  | "tasks"
  | "calendar"
  | "blocks"
  | "pomodoro"
  | "spotify"
  | "toolkit"
  | "generic";

export type ContextPanelDescriptor = {
  id: ContextPanelId;
  /** Human-readable page name shown in the panel header. */
  label: string;
};

type RouteRule = {
  /** Exact match when `exact`, otherwise a prefix match on the pathname. */
  path: string;
  exact?: boolean;
  descriptor: ContextPanelDescriptor;
};

const ROUTE_RULES: RouteRule[] = [
  { path: "/", exact: true, descriptor: { id: "home", label: "Home" } },
  { path: "/tasks", descriptor: { id: "tasks", label: "Tasks" } },
  { path: "/projects", descriptor: { id: "generic", label: "Projects" } },
  // Before "/calendar": rules are matched in order, first hit wins.
  { path: "/calendar/blocks", descriptor: { id: "blocks", label: "Blocks" } },
  { path: "/calendar", descriptor: { id: "calendar", label: "Calendar" } },
  { path: "/pomodoro", descriptor: { id: "pomodoro", label: "Pomodoro" } },
  { path: "/spotify", descriptor: { id: "spotify", label: "Spotify" } },
  { path: "/toolkit", descriptor: { id: "toolkit", label: "Toolbox" } },
  { path: "/apps", descriptor: { id: "generic", label: "Apps" } },
  { path: "/social", descriptor: { id: "generic", label: "Social" } },
];

const FALLBACK: ContextPanelDescriptor = { id: "generic", label: "Page" };

function pathStartsWithSegment(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function resolveContextPanel(pathname: string): ContextPanelDescriptor {
  for (const rule of ROUTE_RULES) {
    const matches = rule.exact
      ? pathname === rule.path
      : pathStartsWithSegment(pathname, rule.path);
    if (matches) return rule.descriptor;
  }
  return FALLBACK;
}
