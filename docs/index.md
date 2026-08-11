---
layout: home

hero:
  name: drizzle-migrate-neon-http
  text: Drizzle migrations on Neon's HTTP driver
  tagline: One statement at a time. Zero local Postgres, zero emulation, zero compromises.
  image:
    src: /neon-mark.svg
    alt: drizzle-migrate-neon-http
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Why this exists
      link: /guide/why
    - theme: alt
      text: View on GitHub
      link: https://github.com/gtnorbeat/drizzle-migrate-neon-http

features:
  - icon: ⚡
    title: Neon HTTP first
    details: Built specifically for the @neondatabase/serverless HTTP driver. No TCP tunnels, no Hyperdrive, no local emulation.
  - icon: 🧩
    title: Statement-aware splitting
    details: A string-literal-aware splitter that handles comments, escaped quotes and semicolons inside data safely.
  - icon: 🪄
    title: Idempotent by design
    details: Skips "object already exists" errors so re-runs on partially-applied schemas heal instead of exploding.
  - icon: 🗂️
    title: Drizzle journal native
    details: Reads meta/_journal.json and tracks applied files by SHA-256 in your database — same model as drizzle-kit.
  - icon: 🖥️
    title: CLI + importable API
    details: Use the binary in CI, or import runMigrations() and splitStatements() in your own tooling.
  - icon: 🛡️
    title: Zero business logic
    details: A focused utility that knows only migrations, SQL and Neon. Drop it in any serverless Postgres project.
---
