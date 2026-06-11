# skins-mcp

**Convert a vibe, a URL, or an image into a complete React + Tailwind + Framer Motion design system.**

`skins-mcp` is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that exposes three tools for generating production-ready design systems. Every tool returns the same canonical five-output shape — design tokens, five TSX components, a full-page layout, a self-contained HTML preview, and copy-paste `.tsx` files — so a downstream LLM (Claude, GPT-4, etc.) can splat the result into a real codebase in one shot.

- **Text in → design system out.** `generate_from_vibe` matches a free-form description against eight curated design presets (cyberpunk, brutalist, luxury, pastel, monochrome, retro, organic, glassmorphism) and refines the result via an optional LLM pass.
- **URL in → design system out.** `generate_from_url` scrapes a public web page, extracts its dominant colors and font families with `cheerio`, and maps them to Tailwind v3.4 tiers.
- **Image in → design system out.** `generate_from_image` decodes a base64 PNG/JPG, quantizes it to a 5-color palette via k-means, and maps each centroid to the closest Tailwind tier.

> 🟢 **No API key required.** The server ships with eight built-in design presets. The LLM is invoked *only* to refine vibes that don't match any preset's keywords — set `OPENAI_API_KEY` to enable that path, or leave it unset and every call falls back to the closest-scoring preset.

---

## Quickstart

```bash
# 1. Install
npm install

# 2. Build (type-checks + emits dist/)
npm run build

# 3. Run the MCP server over stdio
npx ts-node src/index.ts
# → stderr: "skins-mcp ready"
```

The server then waits for JSON-RPC messages on stdin and writes responses to stdout (the standard MCP stdio contract). Configure your MCP client to spawn the server as a subprocess — see the [Claude Desktop](#claude-desktop-mcp-config) section below.

To run the end-to-end demo (writes the three sample design systems to `demo-output/{vibe,url,image}/`):

```bash
npm run demo        # → exits 0 on success
# or
npx ts-node demo.ts
```

---

## Table of contents

1. [The three tools](#the-three-tools)
   - [`generate_from_vibe`](#generate_from_vibe)
   - [`generate_from_url`](#generate_from_url)
   - [`generate_from_image`](#generate_from_image)
2. [Canonical output shape](#canonical-output-shape)
3. [Built-in presets (no API key required)](#built-in-presets-no-api-key-required)
4. [Environment variables](#environment-variables)
5. [Claude Desktop MCP config](#claude-desktop-mcp-config)
6. [Architecture overview](#architecture-overview)
7. [Available npm scripts](#available-npm-scripts)
8. [Stack](#stack)

---

## The three tools

Every tool returns the same [canonical five-output shape](#canonical-output-shape). Transport failures (unreachable URL, invalid base64, corrupted image) are returned as `{ ok: false, error: string }` rather than thrown.

### `generate_from_vibe`

Match a free-form description against the built-in presets, optionally refining via an LLM.

| Field     | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `vibe`    | string | yes      | Natural-language description of the desired design system. Example: `"dark luxury crypto dashboard"`. |

**Example call:**

```json
{
  "method": "tools/call",
  "params": {
    "name": "generate_from_vibe",
    "arguments": { "vibe": "dark luxury crypto dashboard" }
  }
}
```

**Behavior:**

1. Score the vibe against every preset's `keywords` (sub-string match with word-boundary awareness). Highest score wins; ties resolve in declaration order.
2. If the best score is 0 (no match) and the LLM is configured, ask the model to generate a fresh `DesignTokens` bundle validated against the Zod schema.
3. On any LLM failure (missing key, HTTP error, Zod parse failure), fall back to the first-declared preset (cyberpunk) and log a `stderr` line.
4. Return the canonical five outputs.

Annotations: `readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: true` (depends on whether the LLM is configured).

### `generate_from_url`

Scrape a public web page, extract up to 6 dominant colors + font-family declarations + a density hint, and feed them to the token generator.

| Field | Type   | Required | Description |
| ----- | ------ | -------- | ----------- |
| `url` | string | yes      | Absolute URL of a public web page to scrape. Example: `"https://example.com"`. |

**Example call:**

```json
{
  "method": "tools/call",
  "params": {
    "name": "generate_from_url",
    "arguments": { "url": "https://example.com" }
  }
}
```

**Behavior:**

1. `fetch` the URL with a 10-second `AbortSignal.timeout`, following redirects, with a custom `User-Agent`.
2. Parse the HTML with `cheerio`; extract up to 6 frequency-ranked hex colors from inline `style` attributes and the first `<style>` block (3/4/6/8-digit hex normalized to 6-digit lowercase).
3. Extract `font-family` declarations from the same sources, excluding CSS keywords like `sans-serif`, `serif`, `system-ui`, etc.
4. Compute a density hint (`"dense"` if the page is element-heavy, else `"comfortable"`).
5. Forward `{ colors, fontHints }` to the token generator and return the canonical five outputs.

On transport failure (network error, non-2xx HTTP, malformed URL), the tool returns `{ ok: false, error: "<message>" }` rather than throwing.

Annotations: `readOnlyHint: true`, `idempotentHint: false` (a URL's HTML can change between calls), `openWorldHint: true`.

### `generate_from_image`

Decode a base64 image, quantize it to a 5-color palette, and feed the palette to the token generator.

| Field         | Type   | Required | Description |
| ------------- | ------ | -------- | ----------- |
| `imageBase64` | string | yes      | Base64-encoded image payload (PNG, JPEG, WebP, etc.). `sharp` infers the format from the buffer's magic bytes. |
| `mimeType`    | string | no       | Optional MIME type hint, e.g. `"image/png"`. |

**Example call:**

```json
{
  "method": "tools/call",
  "params": {
    "name": "generate_from_image",
    "arguments": {
      "imageBase64": "iVBORw0KGgoAAAANSUhEUgAA...<truncated>",
      "mimeType": "image/png"
    }
  }
}
```

**Behavior:**

1. Decode `imageBase64` → `Buffer`.
2. `sharp` resizes to 64×64 raw RGB.
3. K-means-lite (k=5, k-means++ seeding) over the 4096 pixels produces a palette sorted by population.
4. Each centroid hex is mapped to the closest Tailwind v3.4 tier via Euclidean RGB distance.
5. The first three palette colors override `colors.primary` / `colors.secondary` / `colors.accent`; the remaining two are accepted (and ignored) for caller convenience.
6. Forward `{ vibe: "image", colors: palette.hex }` to the token generator and return the canonical five outputs.

The success response additionally carries a `palette` field (debug metadata: hex, counts, tierNames) so callers can inspect the extracted colors without re-running the quantizer.

On transport failure (empty buffer, sharp decode failure, corrupted image), the tool returns `{ ok: false, error: "<message>" }` rather than throwing.

Annotations: `readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: false`.

---

## Canonical output shape

Every successful tool call returns the same JSON object. The keys are the same; the contents are determined by the input vibe/URL/image.

```typescript
interface ToolOutput {
  tokens: DesignTokens;              // colors, typography, spacing, motion, shadows, radius
  components: Record<string, string>; // 5 entries: Button, Card, Input, Navbar, StatCard
  layout: string;                    // one TSX string composing a full `DemoPage`
  preview: string;                   // one self-contained HTML document
  files: Record<string, string>;      // component-name → TSX string (alias of `components`)
}
```

Where `DesignTokens` looks like:

```typescript
interface DesignTokens {
  colors: {
    primary: string;     // e.g. "fuchsia-500"
    secondary: string;   // e.g. "cyan-400"
    accent: string;      // e.g. "yellow-300"
    background: string;  // e.g. "slate-950"
    surface: string;     // e.g. "slate-900"
    foreground: string;  // e.g. "slate-50"
    muted: string;       // e.g. "slate-400"
    border: string;      // e.g. "fuchsia-500"
    success: string;     // e.g. "emerald-400"
    warning: string;     // e.g. "amber-400"
    danger: string;      // e.g. "rose-500"
  };
  typography: {
    fontFamily: { display: string; body: string; mono: string };
    fontSize:   { xs: string; sm: string; base: string; lg: string; xl: string; "2xl": string; "3xl": string; "4xl": string };
    fontWeight: { normal: string; medium: string; semibold: string; bold: string };
  };
  spacing: { xs: string; sm: string; md: string; lg: string; xl: string; "2xl": string; "3xl": string };
  motion:  { durationBase: number; durationFast: number; durationSlow: number; easeOut: string; easeIn: string; easeInOut: string; staggerChildren: number };
  shadows: { none: string; sm: string; md: string; lg: string; xl: string; glow: string };
  radius:  { none: string; sm: string; md: string; lg: string; xl: string; full: string };
}
```

Every Tailwind class fragment is a real utility class from Tailwind v3.4+. Every color is a `family-shade` name like `"emerald-400"` or `"slate-950"` (or `"black"` / `"white"`). Every font family is a real Google Font.

**Five outputs in practice:**

```json
{
  "tokens": {
    "colors": { "primary": "fuchsia-500", "secondary": "cyan-400", "...": "..." },
    "typography": { "fontFamily": { "display": "Orbitron", "body": "JetBrains Mono", "mono": "JetBrains Mono" }, "...": "..." },
    "...": "..."
  },
  "components": {
    "Button": "import * as React from \"react\";\nimport { motion, ... } from \"framer-motion\";\n\nexport type ButtonVariant = ...\n...",
    "Card": "...",
    "Input": "...",
    "Navbar": "...",
    "StatCard": "..."
  },
  "layout": "import * as React from \"react\";\nimport { motion, type Variants } from \"framer-motion\";\nimport { Button, Card, ... } from \"./components\";\n\nexport function DemoPage() {\n  ...\n}\n",
  "preview": "<!doctype html>\n<html lang=\"en\">\n<head>\n  <script src=\"https://cdn.tailwindcss.com\"></script>\n  ...\n</head>\n<body>...</body>\n</html>",
  "files": { "Button": "...", "Card": "...", "Input": "...", "Navbar": "...", "StatCard": "..." }
}
```

The `preview` HTML is **fully self-contained**: open it directly in a browser (no build step) and the page renders with the correct colors, fonts, and motion.

---

## Built-in presets (no API key required)

The server ships with **eight curated design presets** plus a ninth terminal-themed companion. Every preset is a self-describing bundle of `keywords` (used by `generateTokens` to score incoming vibes), a full `DesignTokens` bundle, and a `motionStyle` discriminator. The first three:

| Preset         | Vibe keywords (excerpt) | Primary | Display font | Motion |
| -------------- | ----------------------- | ------- | ------------ | ------ |
| `cyberpunk`    | neon, magenta, terminal, matrix, synthwave, dystopian | `fuchsia-500` | Orbitron | snappy |
| `brutalist`    | brutal, stark, monospace, industrial, frank, harsh | `neutral-900` | Archivo Black | snappy |
| `luxury`       | elegant, premium, jewel, serif, rich, champagne | `amber-600` | Playfair Display | slow |
| `pastel`       | soft, cute, gentle, kawaii, candy, mint, powder | `pink-300` | Quicksand | smooth |
| `monochrome`   | grayscale, minimal, achromatic, tin, graphite, noir | `neutral-900` | Inter | smooth |
| `retro`        | vintage, 70s, 80s, sepia, warm, diner, faded | `orange-600` | DM Serif Display | smooth |
| `organic`      | natural, earthy, botanical, forest, wood, sage | `green-700` | Fraunces | slow |
| `glassmorphism`| glass, frosted, translucent, blur, vibrant, aurora | `indigo-500` | Poppins | smooth |
| `terminal`*    | cli, console, hacker, phosphor, crt, shell, ascii | `green-400` | JetBrains Mono | snappy |

\* `terminal` is a companion to `cyberpunk` for vibe strings that mix the two (e.g. `"neon cyberpunk terminal"`).

When a caller's vibe matches more than one preset's keywords, the highest-scoring preset wins. Ties resolve in declaration order. The closest-scoring preset is *always* used as the fallback when the LLM path fails (or is disabled), so a vibe like `"neon cyberpunk terminal aesthetic with magenta accents"` deterministically resolves to `cyberpunk` even without an API key.

> 💡 Try a few vibes with the demo to see how the preset selector works: `npm run demo`.

---

## Environment variables

All three variables are **optional**. The server runs without any of them; the LLM refinement path is simply skipped.

| Variable          | Required | Default                       | Description |
| ----------------- | -------- | ----------------------------- | ----------- |
| `OPENAI_API_KEY`  | no       | (none)                        | Bearer token for the OpenAI-compatible endpoint. **If unset, the LLM path is disabled and every call falls back to the closest-scoring preset.** |
| `OPENAI_BASE_URL` | no       | `https://api.openai.com/v1`   | Base URL of the chat completions endpoint. Override this to point at any OpenAI-compatible provider (LM Studio, Ollama with the OpenAI shim, Azure, Together, etc.). |
| `OPENAI_MODEL`    | no       | `gpt-4o-mini`                 | Model name passed to `chat.completions.create`. |

The server reads these at the top of each `callLlm` invocation — no restart required to pick up changes. (The OpenAI client is constructed per call rather than cached, so an `OPENAI_BASE_URL` change is honored on the very next call.)

When the LLM is invoked, the request includes `response_format: { type: "json_object" }` and a system message instructing the model to emit a single valid JSON object that matches the caller's Zod schema. The model's content is `JSON.parse`d and returned to the caller; the caller is responsible for the final Zod validation.

---

## Claude Desktop MCP config

Add the following snippet to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "skins-mcp": {
      "command": "npx",
      "args": ["ts-node", "/absolute/path/to/skins/src/index.ts"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

If you prefer the compiled path (faster startup, no `ts-node` overhead):

```json
{
  "mcpServers": {
    "skins-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/skins/dist/src/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

Replace `/absolute/path/to/skins` with the real path to this repository, and `skins-...` with your real OpenAI key (or omit the `env` block entirely to run with built-in presets only).

> 📦 The `npx` form requires `npm install` to have been run inside this repo so `node_modules/.bin/ts-node` exists. The `node` form requires `npm run build` so `dist/src/index.js` exists.

After updating the config, **fully quit and re-open Claude Desktop** so the new MCP server is registered. You can verify the registration in Claude Desktop's developer console:

```
[skins-mcp] [info] Server started and connected successfully
[skins-mcp] [info] Registered tools: generate_from_vibe, generate_from_url, generate_from_image
```

Then in any conversation, the three tools appear under the "🔨" (hammer) menu and can be invoked by name.

---

## Architecture overview

```
src/
├── types.ts                  # DesignTokens, ToolOutput, Preset, etc.
├── llm.ts                    # OpenAI-compatible LLM client + LlmUnavailableError
├── index.ts                  # MCP server entry point (3 tools + stdio transport)
├── vibes/
│   └── presets.ts            # 8+ built-in design presets
├── generators/
│   ├── tokens.ts             # vibe/colors/fontHints → DesignTokens
│   ├── components.ts         # DesignTokens → 5 TSX components
│   ├── layout.ts             # DesignTokens → full-page TSX layout
│   └── preview.ts            # DesignTokens + layout → self-contained HTML
└── tools/
    ├── from-vibe.ts          # MCP tool: generate_from_vibe
    ├── from-url.ts           # MCP tool: generate_from_url
    └── from-image.ts         # MCP tool: generate_from_image
```

The **flow** for every tool:

```
input ──► extract signals ──► generateTokens()  ─┐
                                                  ├─► generateComponents()
                                                  ├─► generateLayout()
                                                  └─► generatePreview()
```

`generateTokens` is the only step with conditional fallback logic: it scores the input against every preset's keywords, picks the highest-scoring preset as the starting tokens, optionally refines via the LLM, applies color/font overrides, and returns the final `DesignTokens`. Any LLM failure is caught and the closest-preset fallback is used — the function never throws on transport-level errors.

The remaining generators are pure functions of the resolved tokens, so the same `DesignTokens` always produces the same `components` / `layout` / `preview`.

---

## Available npm scripts

| Script              | Command                                | What it does |
| ------------------- | -------------------------------------- | ------------ |
| `npm run start`     | `ts-node src/index.ts`                 | Start the MCP server over stdio. |
| `npm run demo`      | `ts-node demo.ts`                      | Run the end-to-end demo (vibe + url + image) → writes `demo-output/{vibe,url,image}/`. Exits 0 on success. |
| `npm run build`     | `tsc`                                  | Type-check + emit `dist/`. |
| `npm run verify`    | `tsc --noEmit && node scripts/verify-output.mjs` | Type-check + run the output-shape verifier against `demo-output/*/components.json`. |

---

## Stack

- **Language**: TypeScript 5.4, strict mode
- **Runtime**: Node.js ≥ 18
- **Server SDK**: [`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk) 1.x (`McpServer` + `StdioServerTransport`)
- **Schema**: [`zod`](https://www.npmjs.com/package/zod) 3.x
- **HTML parsing**: [`cheerio`](https://www.npmjs.com/package/cheerio) 1.x
- **Image processing**: [`sharp`](https://www.npmjs.com/package/sharp) 0.33.x
- **LLM client**: [`openai`](https://www.npmjs.com/package/openai) 4.x (OpenAI-compatible; `OPENAI_BASE_URL` may redirect to any compatible endpoint)
- **UI primitives** (in generated output only): React 18, Tailwind 3.4+ utility classes, [`framer-motion`](https://www.npmjs.com/package/framer-motion) 11

---

## License

MIT
