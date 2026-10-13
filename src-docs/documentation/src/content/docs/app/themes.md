---
title: Color Themes
description: Make your own RiseByDay color theme with a JSON file
---

A color theme is a small JSON file that sets the app's colors. RiseByDay ships
with **Yacht Club** (the default) and **Classic**, and you can add as many of
your own as you like.

## Installing a theme

Open **Settings → Appearance → Color theme**, then either:

- click **Import theme JSON** and pick a file, or
- click **Show themes folder** and drop `.json` files into it.

The folder sits inside RiseByDay's own settings folder, so use
**Show themes folder** to open it rather than looking for it by hand.

Files there are yours. They survive app updates, and you can back them up,
share them, or edit them in any text editor. The list refreshes whenever you
switch back to the app. A file that doesn't parse is listed with the reason
it was skipped.

## The smallest useful theme

Every token you leave out comes from the theme named in `extends`. So a theme
can be as small as an accent color:

```json
{
  "schemaVersion": 1,
  "id": "forest",
  "name": "Forest",
  "appearance": "both",
  "extends": "yacht-club",
  "colors": {
    "light": { "accent": "#15803D" },
    "dark":  { "accent": "#4ADE80", "accent-ink": "#052E16" }
  }
}
```

`accent-soft` (the tinted background behind selected items) is worked out
from `accent` automatically, so you don't need to set it.

## A complete sample

Save this as `paper.json` in your themes folder:

```json
{
  "schemaVersion": 1,
  "id": "paper",
  "name": "Paper",
  "author": "Joshua Rashtian",
  "version": "1.0.0",
  "description": "Warm off-white with a rust accent.",
  "appearance": "both",
  "colors": {
    "light": {
      "canvas":  "#F7F3EA",
      "surface": "#FFFDF8",
      "raised":  "#FFFFFF",
      "sunken":  "#EFE9DC",

      "ink":   "#2B2620",
      "muted": "#6B6157",
      "faint": "#A39A8E",

      "line":        "#E4DCCC",
      "line-strong": "#CFC4B0",

      "accent":       "#9A3412",
      "accent-hover": "#7C2D12",
      "accent-ink":   "#FFFDF8",

      "secondary": "#3F6212",

      "danger":  "#B42318",
      "success": "#2F6B4F",
      "warn":    "#B45309",

      "overlay": "rgba(43, 38, 32, 0.4)"
    },
    "dark": {
      "canvas":  "#1A1714",
      "surface": "#23201B",
      "raised":  "#2D2923",
      "sunken":  "#161310",

      "ink":   "#F1EBE0",
      "muted": "#B3A998",
      "faint": "#7D7466",

      "line":        "#3A342C",
      "line-strong": "#4A4238",

      "accent":       "#FDBA74",
      "accent-hover": "#FED7AA",
      "accent-ink":   "#1A1714",

      "secondary": "#A3C76B",

      "danger":  "#F07167",
      "success": "#6FBF97",
      "warn":    "#E0A458",

      "overlay": "rgba(0, 0, 0, 0.6)"
    }
  },
  "components": {
    "light": {
      "sidebar-bg":         "#2B2620",
      "sidebar-ink":        "#CFC4B0",
      "sidebar-ink-active": "#FFFDF8",
      "sidebar-item-hover": "rgba(255, 255, 255, 0.08)",
      "sidebar-line":       "#3A342C"
    }
  }
}
```

The `components` block above gives the light mode a dark sidebar. Leave it
out and the sidebar follows the base colors.

## Fields

| Field | Required | Notes |
|---|---|---|
| `schemaVersion` | yes | Always `1` for now. |
| `id` | yes | Lowercase letters, numbers and dashes. Must be unique and can't be `yacht-club` or `classic`. |
| `name` | yes | Shown in Settings. |
| `appearance` | yes | `"both"`, `"light"` or `"dark"`. A one-mode theme uses that palette in both modes. |
| `extends` | no | Id of the theme that supplies any color you leave out. Defaults to Yacht Club. |
| `author`, `version`, `description` | no | Shown in Settings. |
| `colors.light`, `colors.dark` | no | Base tokens, below. |
| `components.light`, `components.dark` | no | Per-surface overrides, below. |

## Base tokens

| Token | Used for |
|---|---|
| `canvas` | Page background |
| `surface` | Cards and panels |
| `raised` | Popups and menus |
| `sunken` | Inputs and wells |
| `ink` | Primary text |
| `muted` | Secondary text |
| `faint` | Placeholders and tertiary text |
| `line` | Borders and dividers |
| `line-strong` | Emphasized borders |
| `accent` | Buttons, links, selected items |
| `accent-hover` | Accent on hover |
| `accent-soft` | Tinted background behind selected items (derived if omitted) |
| `accent-ink` | Text on top of `accent` |
| `secondary` | Second highlight color, e.g. the current block |
| `secondary-soft` | Tinted `secondary` (derived if omitted) |
| `danger`, `success`, `warn` | Status colors (each has a `-soft` variant, derived if omitted) |
| `overlay` | Dim layer behind modals |

## Component tokens

These default to a base token. Set them only when one surface should look
different from the rest of the app.

| Token | Defaults to |
|---|---|
| `sidebar-bg` | `sunken` |
| `sidebar-ink` | `muted` |
| `sidebar-ink-active` | `ink` |
| `sidebar-item-hover` | `line` |
| `sidebar-item-active` | transparent |
| `sidebar-line` | `line` |
| `input-bg`, `input-line`, `input-focus` | `sunken`, `line`, `accent` |
| `card-bg`, `card-line` | `surface`, `line` |
| `popover-bg` | `raised` |

## Allowed color values

Colors must be hex (`#245F73`, `#245F7380`), `rgb()`/`rgba()`, or
`hsl()`/`hsla()`. Anything else is rejected, including CSS variables,
gradients, `url()` and named colors like `red`. That keeps theme files safe to
share, and it lets the same file work on every RiseByDay client.

:::tip
Check that `ink` and `muted` stay readable on `canvas` and `surface`, and that
`accent-ink` is readable on `accent`. Aim for a contrast ratio of at least
4.5:1.
:::
