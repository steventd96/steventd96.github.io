# steventd96.github.io

Personal blog built with [Astro](https://astro.build). Static, fast, and
zero client-side JavaScript by default (aside from the ~15-line theme toggle).

## Writing a post

Drop a markdown file in `src/content/blog/`. The filename becomes the URL slug
(`my-post.md` → `/blog/my-post/`). Frontmatter:

```markdown
---
title: 'My post title'
description: 'A one-line summary shown in listings and meta tags.'
pubDate: 2026-07-07
updatedDate: 2026-07-10   # optional
tags: ['engineering', 'notes']
draft: false              # set true to hide from the site
---

Your content here…
```

Reading time is computed automatically. Frontmatter is validated at build
time (see `src/content.config.ts`) — a bad date or missing field fails the
build instead of shipping broken pages.

## Project structure

```text
src/
├── components/     # Header, Footer, ThemeToggle, PostCard, etc.
├── content/blog/   # ← your markdown posts live here
├── layouts/        # BaseLayout, BlogPost
├── pages/          # index, blog/, about, 404, rss.xml
├── plugins/        # remark-reading-time
├── styles/         # global.css (design tokens + light/dark themes)
└── consts.ts       # site title, tagline, social links — edit here
public/             # favicon, OG image, static assets
```

To change the site title, description, or social links, edit `src/consts.ts`.
To change colors/typography, edit the tokens at the top of `src/styles/global.css`.

## Commands

| Command           | Action                                    |
| :---------------- | :---------------------------------------- |
| `npm install`     | Install dependencies                      |
| `npm run dev`     | Dev server at `localhost:4321`            |
| `npm run build`   | Build to `./dist/`                        |
| `npm run preview` | Preview the production build locally      |

## Deployment

Pushes to `main` build and deploy automatically via GitHub Actions
(`.github/workflows/deploy.yml`). In the repo settings, set
**Settings → Pages → Source** to **GitHub Actions**.
