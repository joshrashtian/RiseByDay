---
title: Task Language Parser
description: Set a task's priority, time, block, category and tags while you type its title.
---

The task creator and the Cognition Bar (<kbd>⌥</kbd> <kbd>R</kbd>) read short
tokens out of what you type. Everything that isn't a token becomes the title,
and a row of hints under the input shows what was picked up as you go.

```txt
Write report !high %Work @@School #essay @tomorrow @3pm
```

That creates **Write report** — high priority, in the Work block, filed under
School, tagged `essay`, due tomorrow at 3:00 PM.

## Tokens

| Token | Sets | Examples |
|---|---|---|
| `!` | Priority | `!high` `!h` · `!medium` `!m` · `!low` `!l` · a lone `!` means high |
| `!!` | Critical | `!!` |
| `%` | Block | `%Work` · `%Early Morning` · `%"Deep Work"` |
| `@@` | Category | `@@School` · `@@"Side Projects"` |
| `#` | Tag (repeatable) | `#essay` `#q4` |
| `@` | Due date / time | `@tomorrow` `@3pm` `@10/24` |

Tokens can go anywhere on the first line, in any order, separated by spaces.

### Priority and critical

`!high`, `!medium` and `!low` (or `!h`, `!m`, `!l`) set the priority. A bare `!`
followed by a space is shorthand for high. `!!` on its own marks the task
critical, which is separate from priority — you can use both.

### Blocks

`%` assigns the task to a [block](/guides/getting-started/). One-word names need
nothing extra: `%Work`. The built-in multi-word blocks — `%Early Morning` and
`%Late Night` — also work as-is. For any other name with a space, wrap it in
quotes: `%"Deep Work"`.

### Categories

`@@` sets the category: `@@School`, or `@@"Side Projects"` for names with
spaces. Straight and curly quotes both work.

### Tags

Each `#word` adds a tag. Tags may contain letters, numbers, `_`, `.` and `-`.

## Dates and times

`@` takes a single word — no spaces — and understands:

| You type | Means |
|---|---|
| `@today` · `@tomorrow` | That day |
| `@tonight` | 6:00 PM |
| `@3pm` · `@3:30pm` · `@15:30` | A time |
| `@10/24` · `@10/24/2026` | A date (`M/D` rolls to next year once it has passed) |
| `@2026-10-24` | An ISO date |
| `@2026-10-24T15:30` | An ISO date and time |

Combine a date token with a time token to get both: `@tomorrow @9am`.

When only part is given:

- **Time only** → today at that time.
- **Date only** → 11:59 PM that day.

### Ranges

Give a task an end time with a dash or arrow inside one token:

```txt
Standup @9am-9:15am
Focus block @1pm->3pm
```

Or, at the very start of the input, put `to`, `till`, `until` or `->` between
two `@` tokens:

```txt
@9pm to @1am Night shift
```

If the end comes before the start and has no date of its own, it rolls over to
the next day — so the example above ends at 1:00 AM tomorrow.

## Things to know

- **Only the first line is parsed.** Anything on later lines is kept as-is in
  the title.
- **An unrecognised token ends parsing.** If a token can't be read — say
  `@someday` — the hints show it as unfinished and the rest of that line is left
  out of the title. Fix or remove the token before saving.
- **Words that merely contain the symbols are fine.** Only words that *start*
  with `!`, `%`, `@` or `#` are treated as tokens, so `me@example.com` stays in
  the title.
