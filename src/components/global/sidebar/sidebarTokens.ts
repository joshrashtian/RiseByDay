/**
 * The sidebar's class tokens. Colors come from the `--sidebar-*` component
 * tokens (defaults in App.css), so a color theme can restyle the sidebar on
 * its own — e.g. a dark sidebar on a light app — without touching the rest.
 */
export const sidebarTokens = {
  surface: "bg-sidebar",
  navItemActive: "bg-sidebar-item-active text-sidebar-ink-active",
  navItemIdle:
    "text-sidebar-ink hover:bg-sidebar-item-hover hover:text-sidebar-ink-active",
  navAccent: "bg-accent",
  divider: "border-sidebar-line",
  utilityButton:
    "text-faint hover:bg-sidebar-item-hover hover:text-sidebar-ink-active",
  primaryText: "text-ink",
  mutedText: "text-muted",
  softChip: "bg-sunken text-muted",
  focusedItem: "bg-accent-soft ring-1 ring-inset ring-accent/30",
  rowHover: "hover:bg-sidebar-item-hover",
  addButton:
    "border-line-strong text-muted hover:border-accent hover:text-accent",
} as const;

export type SidebarTokens = typeof sidebarTokens;
