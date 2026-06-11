# skins-mcp — Project Standards (claude.md)

This file is the canonical "how we work" reference for the project. Claude and other agents should read it before making non-trivial changes.

## What this project is
`skins-mcp` is a **Model Context Protocol (MCP) server** that converts a natural-language vibe (or a scraped URL, a base64 image, or a motionsites.ai design spec) into a complete React + Tailwind + Framer Motion design system. It exposes four MCP tools:

- `generate_from_vibe` — text → design system (now motionsites-aware: a strong match in the bundled library overrides the preset base)
- `generate_from_url` — URL → design system (fetches + parses)
- `generate_from_image` — base64 PNG/JPG → design system (k-means palette)
- `generate_from_motionsites` — design name / category / keyword → design system, driven by the bundled motionsites.ai library (61 specs)
- `generate_brief` — vibe + optional `target` → a DESIGN BRIEF + build directive (palette, motion, technique toolkit, anti-slop quality bar) that instructs the calling model to *build* an ambitious page itself, rather than returning canned components. Lives in `src/generators/brief.ts` + `src/tools/from-brief.ts`. This is the "make it cook" path.

Every tool returns the same five-output shape: `tokens`, `components` (5 TSX strings), `layout` (one TSX string), `preview` (one self-contained HTML string), and `files` (component-name → TSX string). The vibe and motionsites tools add a `source` field naming the winning preset / design.

The server can run over **stdio** (`src/index.ts`, the default for local MCP clients) or **HTTP/SSE** (`src/server.ts`, `npm run serve`). Note: HTTP/SSE was out of scope in the original AC plan and was added afterward.

## Stack
- **Language**: TypeScript 5.4, strict mode
- **Runtime**: Node.js >= 18
- **Server SDK**: `@modelcontextprotocol/sdk` 1.x (`McpServer` + `StdioServerTransport`, or `SSEServerTransport` via `express` 5.x in `src/server.ts`)
- **Schema**: `zod` 3.x (also re-exported by the SDK for tool inputs)
- **HTML parsing**: `cheerio` 1.x
- **Image processing**: `sharp` 0.33.x
- **LLM client**: `openai` 4.x (OpenAI-compatible; `OPENAI_BASE_URL` may redirect to any compatible endpoint)
- **UI primitives** (in generated output only): React 18, Tailwind 3.4+ utility classes, `framer-motion` 11

## Directory layout
```
.
├── package.json           # name = "skins-mcp", scripts: start / demo / build / verify
├── tsconfig.json          # strict, ES2022, node resolution
├── demo.ts                # AC-13 driver: writes demo-output/{vibe,url,image,motionsites}/
├── src/
│   ├── index.ts           # AC-11: wires the four tools to StdioServerTransport
│   ├── server.ts          # HTTP/SSE transport (express 5.x) — `npm run serve`
│   ├── types.ts           # AC-2: DesignTokens / DesignSystem
│   ├── llm.ts             # AC-12: callLlm + LlmUnavailableError
│   ├── vibes/
│   │   └── presets.ts     # AC-3: 9 hand-tuned presets
│   ├── scrapers/
│   │   ├── motionsites-data.ts            # 61 bundled motionsites.ai prompt specs
│   │   ├── motionsites.ts                 # search/scoring over the bundled library
│   │   └── motionsites-token-extractor.ts # prompt spec → Partial<DesignTokens>
│   ├── generators/
│   │   ├── tokens.ts      # AC-4: generateTokens({ vibe?, colors?, fontHints? })
│   │   ├── components.ts  # AC-5: generateComponents(tokens) → 5 TSX strings
│   │   ├── layout.ts      # AC-6: generateLayout(tokens) → full-page TSX
│   │   ├── preview.ts     # AC-7: generatePreview(tokens, layout) → HTML
│   │   └── tailwind-dict.ts # allow-list of Tailwind classes per component
│   └── tools/
│       ├── from-vibe.ts   # AC-8: registers generate_from_vibe (motionsites-aware)
│       ├── from-url.ts    # AC-9: registers generate_from_url
│       ├── from-image.ts  # AC-10: registers generate_from_image
│       └── from-motionsites.ts # registers generate_from_motionsites
├── scripts/
│   └── verify-output.mjs  # AC-15: regex checks on generated TSX
├── demo-assets/           # generated sample.png for AC-13
├── demo-output/           # written by demo.ts (gitignored)
└── docs/
    └── references/
        └── preview-snapshots/  # AC-16 browser snapshots
```

## Engineering rules
- **Strict TypeScript only**. `npx tsc --noEmit` must pass before any commit.
- **Token-driven generation**. Components / layout / preview are pure templates parameterized by a `DesignTokens` object — never LLM-authored.
- **Tailwind class validity**. Every class in generated output must come from `src/generators/tailwind-dict.ts` and pass the regex `/^[a-z][a-z0-9-]*(\:[a-z0-9-]+)*$/`.
- **Framer Motion API**. Use `import { motion } from "framer-motion"` plus the `variants` + `initial` + `animate` triple.
- **Zero required API keys**. The `from_vibe` path resolves via `src/vibes/presets.ts`. LLM is only a refinement when no preset matches and `OPENAI_API_KEY` is set.
- **Graceful degradation**. If a URL is unreachable, return `{ ok: false, error }` — never throw. If LLM is unavailable, fall back to the closest preset.
- **No silent side effects in library code**. Only `src/index.ts` and `demo.ts` perform I/O at the top level.

## Commands
| Action | Command |
| --- | --- |
| Install | `npm install` |
| Type-check | `npx tsc --noEmit` |
| Run the server | `npx ts-node src/index.ts` |
| Run the end-to-end demo | `npx ts-node demo.ts` |
| Build to `dist/` | `npm run build` |
| Verify outputs | `npm run verify` |

## Environment variables
| Var | Default | Effect |
| --- | --- | --- |
| `OPENAI_API_KEY` | _(unset)_ | When set, enables LLM refinement of vibes that don't match a preset. When unset, the LLM path throws `LlmUnavailableError` and the caller falls back to the closest preset. |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Any OpenAI-compatible endpoint. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model name sent to the chat completions API. |

## Commit conventions
- `chore:` scaffolding, CI, dev-deps
- `feat:` user-facing functionality
- `fix:` bug fix
- `refactor:` no behavior change
- `docs:` README or comments
- `test:` verify script or harness

## Quality gate before "done"
- `npx tsc --noEmit` exits 0
- `npm run verify` exits 0 (after `demo.ts` has run at least once)
- No file in `src/` references a non-existent module
- No file in `src/` has a TODO without an owner
