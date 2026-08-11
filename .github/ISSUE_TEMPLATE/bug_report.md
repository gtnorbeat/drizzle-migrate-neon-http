---
name: 🐛 Bug report
description: Report a problem with drizzle-migrate-neon-http
title: "[bug]: "
labels: ["bug"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to fill out this bug report! Please search
        the [docs](https://gtnorbeat.github.io/drizzle-migrate-neon-http/) and
        existing issues first.
  - type: textarea
    id: what-happened
    attributes:
      label: What happened?
      description: What did you expect to happen, and what happened instead?
      placeholder: "Tell us what you saw — e.g. 'migrate fails with TypeError: ...'"
    validations:
      required: true
  - type: textarea
    id: reproduction
    attributes:
      label: Steps to reproduce
      description: Minimal code — the migration .sql file, script or CLI command that triggers the bug.
      value: |
        ```bash
        drizzle-migrate-neon-http --dir ./drizzle --dry-run
        ```
      render: bash
    validations:
      required: true
  - type: textarea
    id: logs
    attributes:
      label: Relevant logs / error output
      description: Paste the full stack trace or error message. No screenshots of code, please.
      render: shell
  - type: input
    id: version
    attributes:
      label: Package version
      description: What version are you running? (`npm ls drizzle-migrate-neon-http`)
      placeholder: "0.1.3"
    validations:
      required: true
  - type: input
    id: node
    attributes:
      label: Node.js version
      placeholder: "22.0.0"
    validations:
      required: true
  - type: input
    id: driver
    attributes:
      label: "@neondatabase/serverless version"
      placeholder: "1.1.0"
    validations:
      required: true
  - type: dropdown
    id: environment
    attributes:
      label: Environment
      description: Where did the bug happen?
      options:
        - Local machine
        - CI (GitHub Actions)
        - Serverless runtime (Vercel / Cloudflare Workers / etc.)
        - Other
    validations:
      required: true
