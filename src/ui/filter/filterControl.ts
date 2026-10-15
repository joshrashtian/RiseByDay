// Shared look for compact filter/toolbar controls (search boxes, dropdown
// triggers, toggle buttons). Matches src/ui/settings/FileSelect.tsx so every
// control in a filter row reads as one set. Merge extras with twMerge.

/** Shape, surface, text and hover. Every filter control starts here. */
export const filterControlClass =
  'inline-flex h-10 min-w-0 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left text-sm text-ink ring-2 ring-transparent outline-none transition-[background-color,box-shadow,border-color] hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-50'

/** Focus ring for controls that take focus themselves (buttons, triggers). */
export const filterFocusClass = 'focus-visible:ring-accent'

/** Focus ring for wrappers around a focusable child (e.g. a label around an input). */
export const filterFocusWithinClass = 'focus-within:ring-accent'

/** "On" state for toggles and dropdowns with a selection. */
export const filterActiveClass = 'border-accent bg-accent-soft text-ink hover:bg-accent-soft'

/** Leading/trailing icons inside a control. */
export const filterIconClass = 'inline-flex size-4 shrink-0 items-center justify-center text-muted [&>svg]:size-4'
