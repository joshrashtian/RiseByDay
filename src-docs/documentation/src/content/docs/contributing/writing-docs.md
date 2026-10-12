---
title: How These Docs Work
description: A short tour of Starlight, the framework this site is built on
---

This site is built with [Starlight](https://starlight.astro.build), a
documentation theme for [Astro](https://astro.build). You write Markdown;
Starlight turns it into pages with a sidebar, search, dark mode and
navigation for free.

## Run it locally

From `src-docs/documentation`:

```bash
npm install
npm run dev      # http://localhost:4321, live reload
npm run build    # static site in dist/
```

## Every file is a page

Pages live in `src/content/docs/`. The file path becomes the URL:

| File | URL |
|---|---|
| `index.mdx` | `/` |
| `guides/getting-started.md` | `/guides/getting-started/` |
| `app/addtask.md` | `/app/addtask/` |

To add a page, create a `.md` file. It needs a `title` in its frontmatter —
Starlight renders it as the page's heading, so don't repeat it as a `#` heading.

```md
---
title: Blocks
description: Shown in search results and link previews
---

Your content here.
```

## The sidebar

The sidebar is set in `astro.config.mjs`. Each group either lists pages by
hand or fills itself from a folder:

```js
sidebar: [
  {
    label: 'Guides',
    items: [{ label: 'Getting Started', slug: 'guides/getting-started' }],
  },
  {
    label: 'Reference',
    // every page in src/content/docs/reference/, sorted by title
    items: [{ autogenerate: { directory: 'reference' } }],
  },
],
```

A page not in the sidebar still exists at its URL — it just isn't linked.

## Extras

**Callouts** (called "asides"):

```md
:::tip
Helpful hint.
:::

:::caution
Watch out.
:::
```

**Components** like cards and tabs need a `.mdx` file instead of `.md`, then
an import:

```mdx
import { Card, CardGrid } from '@astrojs/starlight/components';

<CardGrid>
  <Card title="Tasks" icon="pencil">Add and organize tasks.</Card>
</CardGrid>
```

Images go in `src/assets/` and are referenced with a relative path.
