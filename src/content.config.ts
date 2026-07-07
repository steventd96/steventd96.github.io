import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Blog posts live as markdown in src/content/blog/. Frontmatter is validated
// against this schema at build time.
const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
