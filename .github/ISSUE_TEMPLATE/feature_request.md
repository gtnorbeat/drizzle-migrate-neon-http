---
name: ✨ Feature request
description: Suggest an idea for drizzle-migrate-neon-http
title: "[feature]: "
labels: ["enhancement"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for suggesting! Remember the project scope: **a focused migration
        runner for Neon's HTTP driver** — not an ORM. Features that fit elsewhere
        are better contributed upstream.
  - type: textarea
    id: problem
    attributes:
      label: Is your feature request related to a problem?
      description: A clear and concise description of what the problem is.
      placeholder: "I'm always frustrated when I try to ..."
    validations:
      required: true
  - type: textarea
    id: solution
    attributes:
      label: Proposed solution
      description: What you'd like to happen, and how it looks from the user's perspective (CLI flag, API shape, output…).
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
      description: What alternatives have you considered, and why aren't they good enough?
  - type: textarea
    id: context
    attributes:
      label: Additional context
      description: Mockups, examples from other tools, links, real-world use cases.
