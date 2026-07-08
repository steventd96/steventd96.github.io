---
title: 'How this blog is built'
description: 'A tour of the Astro setup powering this site — content collections, theming, and zero-JS-by-default rendering.'
pubDate: 2026-07-05
tags: ['astro', 'web', 'tutorial']
draft: true
---

This site is intentionally simple. No database, no CMS, no client framework —
just markdown files compiled to static HTML at build time. Here's how the
pieces fit together.

## Content collections

Every post is a markdown file in `src/content/blog/`. A small schema validates
the frontmatter so a typo in a date fails the build instead of shipping broken
pages:

```ts
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
  }),
});
```

## Theming

Light and dark modes are driven entirely by CSS custom properties on the root
element. An inline script sets the theme *before* the first paint, so there's no
flash of the wrong colors on load.

## Why zero JavaScript matters

Astro ships **no client-side JavaScript by default**. The only script on a
typical page here is the ~15-line theme toggle. Pages load instantly and work
without JS — which is exactly what a reading-focused blog should do.

That's the whole stack. Boring, in the best way.
