# Product

## Register

product

## Users

JavaScript/TypeScript developers using Drizzle ORM with Neon's serverless Postgres
(serverless functions, CI pipelines, edge runtimes). They need their SQL migrations
to run reliably against the Neon HTTP driver — without local Postgres, without
multi-statement pitfalls. They land here from the npm README, GitHub or search,
wanting a working setup in minutes.

## Product Purpose

`drizzle-migrate-neon-http` runs Drizzle-generated SQL migrations on the
`@neondatabase/serverless` HTTP driver, one statement at a time. The docs site
(hosted on GitHub Pages) exists to make that workflow obvious: install, generate,
dry-run, apply. Success looks like a developer who goes from first install to a
green migration run in under five minutes, and who trusts the tool enough to run
it in CI.

## Brand Personality

Expert confidence — precise, calm, exact. The tone is that of a careful engineer
showing you the one right way: "One statement at a time. Zero local Postgres, zero
emulation, zero compromises." The visual identity is Neon's: the bright green mark,
dark-ink text on a clean light surface, green used as a signal (primary actions,
links, highlights), never as decoration.

## Anti-references

- Generic SaaS landing-page templates (centered card grids, gradient heroes).
- Gradient text on the hero title — decorative, not meaningful.
- Dark-terminal-only "dev tool" clichés; the site stays light and readable.
- AI-slop tells: over-rounded cards, soft wide shadows with 1px borders, repeated
  uppercase kickers above every section.

## Design Principles

1. Identity preservation — the Neon mark and #00E5A0 green are the anchor; the
   rest of the palette composes around them, never against them.
2. Clarity over decoration — every color and type choice serves readability of
   the docs; contrast ratios are checked, not assumed.
3. Docs-first hierarchy — nav, sidebar, outline and code blocks do the heavy
   lifting; the home page is a calm landing, not a showcase.
4. Restrained motion — only micro-interactions that convey state; reduced-motion
   is respected.
5. A title is a single line — long package names must never break mid-word in
   the hero or in prose links.

## Accessibility & Inclusion

- WCAG 2.1 AA as the floor: body text ≥ 4.5:1, large text ≥ 3:1.
- Focus-visible states preserved (VitePress defaults).
- `prefers-reduced-motion` respected for any animation.
- Not relying on color alone for meaning (green is an accent, not the only signal).
