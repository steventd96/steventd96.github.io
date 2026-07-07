// Site-wide metadata. Edit these to change titles, descriptions, and links
// across every page.

export const SITE_TITLE = 'Steven Dirjayanto';
export const SITE_TAGLINE = 'Software Engineer & Tech Writer';
export const SITE_DESCRIPTION =
  'A technical blog exploring software engineering, system design, and modern development practices.';

// Deployed origin. Keep in sync with `site` in astro.config.mjs.
export const SITE_URL = 'https://steventd96.github.io';

export const SOCIALS = {
  github: 'https://github.com/steventd96',
  twitter: 'https://twitter.com/SDirjayanto',
  linkedin: 'https://www.linkedin.com/in/stevendirjayanto',
  email: 'mailto:steventd96@gmail.com',
};

export const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
];
