import getReadingTime from 'reading-time';
import { toString } from 'mdast-util-to-string';

// Injects `minutesRead` (e.g. "3 min read") into each post's frontmatter,
// computed from the rendered text. Wired up via astro.config.mjs.
export function remarkReadingTime() {
  return function (tree, { data }) {
    const textOnPage = toString(tree);
    const readingTime = getReadingTime(textOnPage);
    data.astro.frontmatter.minutesRead = readingTime.text;
  };
}
