import { defineConfig } from "vitepress";

export default defineConfig({
  title: "drizzle-migrate-neon-http",
  description: "Run Drizzle SQL migrations on Neon's serverless HTTP driver",
  lang: "en-US",
  base: "/drizzle-migrate-neon-http/",
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/drizzle-migrate-neon-http/neon-mark.svg' }],
    ['meta', { name: 'theme-color', content: '#00E5A0' }],
    ['meta', { name: 'og:title', content: 'drizzle-migrate-neon-http' }],
    ['meta', { name: 'og:description', content: 'Drizzle migrations on Neon HTTP driver — one statement at a time.' }],
  ],
  themeConfig: {
    logo: "/neon-mark.svg",
    nav: [
      { text: "Guide", link: "/guide/why" },
      { text: "CLI", link: "/cli" },
      { text: "API", link: "/api/runMigrations" },
      { text: "GitHub", link: "https://github.com/gtnorbeat/drizzle-migrate-neon-http" },
    ],
    sidebar: [
      {
        text: "Introduction",
        items: [
          { text: "Why this exists", link: "/guide/why" },
          { text: "Getting started", link: "/guide/getting-started" },
          { text: "Troubleshooting", link: "/guide/troubleshooting" },
        ],
      },
      {
        text: "Usage",
        items: [
          { text: "CLI reference", link: "/cli" },
          { text: "Programmatic API", link: "/api/runMigrations" },
          { text: "splitStatements", link: "/api/splitStatements" },
          { text: "Error codes", link: "/api/errors" },
        ],
      },
      {
        text: "Advanced",
        items: [
          { text: "Monorepo & CI", link: "/advanced/ci" },
          { text: "Rollbacks & history", link: "/advanced/history" },
        ],
      },
    ],
    outline: { label: "On this page", level: [2, 3] },
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 astrocat986",
    },
    socialLinks: [{ icon: "github", link: "https://github.com/gtnorbeat/drizzle-migrate-neon-http" }],
  },
});