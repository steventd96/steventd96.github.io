---
title: 'Welcome to the new blog'
description: 'A fresh start — why I rebuilt this site with Astro and what I plan to write about.'
pubDate: 2026-07-07
tags: ['meta', 'astro']
---

After sitting on a stock Jekyll theme for far too long, I finally rebuilt this
site from scratch. It's now a fast, static Astro blog with a light/dark theme
and typography I actually enjoy reading.

## Why the rewrite

The old site did the job, but it never felt like *mine*. I wanted:

- **Fast, minimal pages** — no client-side framework weighing things down.
- **A design I control** — every color and spacing token lives in one CSS file.
- **A frictionless writing flow** — drop a markdown file in a folder and it's a post.

## What I'll write about

This is a technical blog, so expect posts on software engineering, system
design, and the occasional deep dive into something I've been building. A few
topics already on my list:

1. Patterns I keep reaching for in distributed systems.
2. The tradeoffs behind static-site generators.
3. Notes from things that broke in production.

> Writing is thinking. If a topic survives being written down, it was probably
> worth understanding.

Here's a small taste of the kind of code you'll see around here:

```ts
async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 2 ** i * 100));
    }
  }
  throw new Error('unreachable');
}
```

Thanks for stopping by. More soon.
