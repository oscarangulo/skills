# Strixsoft Agent Skills

A curated collection of agent skills for [Claude Code](https://claude.ai/claude-code) — drop-in knowledge modules that give the AI deep, specialized context for specific workflows.

---

## What are Agent Skills?

Agent skills extend Claude Code with opinionated, battle-tested knowledge for specific domains. Each skill lives in its own directory and contains:

| File | Purpose |
|---|---|
| `SKILL.md` | Instructions, workflow steps, and rules the agent follows |
| `assets/` | Templates, boilerplate, and reusable code snippets |
| `references/` | Deep-dive documentation, gotchas, and lookup tables |

---

## Skills

### [`nextjs-og-image`](./nextjs-og-image)

Generate production-quality dynamic Open Graph images for Next.js App Router projects using `next/og` (Satori).

**Triggers:** create OG image · fix social sharing preview · add `og:image` support · set up `opengraph-image.tsx` · multi-domain OG metadata · Satori rendering bugs

**Covers:**
- `opengraph-image.tsx` boilerplate with all Satori constraints enforced
- Multi-domain deployments (e.g. Vercel serving `example.com` + `example.cl`)
- `generateMetadata()` with dynamic `metadataBase` via `x-forwarded-host`
- Favicon and `site.webmanifest` configuration
- Title / description character limits for all platforms
- Full Satori CSS gotchas reference with working workarounds

---

## Installation

Skills are loaded by referencing the `SKILL.md` file in your Claude Code project settings.

**Option A — project-level (`.claude/settings.json`)**

```json
{
  "skills": [
    "/path/to/strixsoft-skills/nextjs-og-image/SKILL.md"
  ]
}
```

**Option B — global (`~/.claude/settings.json`)**

```json
{
  "skills": [
    "/path/to/strixsoft-skills/nextjs-og-image/SKILL.md"
  ]
}
```

> Replace `/path/to/strixsoft-skills` with the absolute path where you cloned this repo.

---

## Skill Structure

```
<skill-name>/
├── SKILL.md              # Agent instructions (frontmatter + workflow)
├── assets/               # Copy-paste templates and boilerplate
│   └── *.tsx / *.ts
└── references/           # Reference docs, gotchas, lookup tables
    └── *.md
```

The `SKILL.md` frontmatter uses the standard Agent Skills format:

```yaml
---
name: skill-name
description: One-line description of when Claude should activate this skill.
---
```

---

## Contributing

1. Create a new directory named after your skill (kebab-case).
2. Add a `SKILL.md` with a clear frontmatter `description` — this is what the agent uses to decide when to apply the skill.
3. Add `assets/` and `references/` as needed.
4. Document the skill in the table above.

---

## License

MIT
