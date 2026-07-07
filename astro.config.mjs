// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { remarkReadingTime } from './src/plugins/remark-reading-time.mjs';

// https://astro.build/config
export default defineConfig({
  // Deployed origin — used for canonical URLs, sitemap, and RSS.
  site: 'https://steventd96.github.io',
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [remarkReadingTime],
    shikiConfig: {
      // Syntax-highlighting themes for light and dark code blocks.
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  },
});
