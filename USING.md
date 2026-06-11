# Using skins-mcp

Turn a **vibe, a URL, an image, or a design name** into a production-ready React + Tailwind + Framer Motion design system — from inside your AI assistant, in one tool call.

- **Live server:** `https://skins-mcp-production.up.railway.app`
- **MCP endpoint:** `https://skins-mcp-production.up.railway.app/sse`
- **Health check:** `curl https://skins-mcp-production.up.railway.app/health`
- **No API key required.**

---

## 1. Connect it to your assistant

### Claude Code
```bash
claude mcp add --transport sse skins https://skins-mcp-production.up.railway.app/sse
claude mcp list      # verify it shows up
```

### Claude Desktop
Edit your config file:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "skins": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://skins-mcp-production.up.railway.app/sse"]
    }
  }
}
```
Fully quit and reopen Claude Desktop. The four tools appear under the 🔨 (tools) icon.

### Codex CLI
Add to `~/.codex/config.toml`:
```toml
[mcp_servers.skins]
command = "npx"
args = ["-y", "mcp-remote", "https://skins-mcp-production.up.railway.app/sse"]
```

> Claude Desktop and Codex speak **stdio**, so they reach the hosted URL through the `mcp-remote` bridge (auto-installed by `npx`). Claude Code supports remote SSE directly.

### Prefer to run it locally (no remote server)?
```bash
git clone https://github.com/neromtoobad/skins.git && cd skins
npm install && npm run build
```
Then point your client at the compiled stdio entry:
```json
{ "mcpServers": { "skins": { "command": "node", "args": ["/absolute/path/to/skins/dist/src/index.js"] } } }
```

---

## 2. How you actually use it

You don't write JSON-RPC by hand. Once connected, just ask your assistant in plain English — it picks the right tool and calls it:

- "Use **skins** to generate a design system for a **dark luxury crypto dashboard**."
- "Generate a design system from **https://stripe.com**."
- "**Browse** skins motionsites designs for **portfolio**." → list mode, no generation
- "Build a design system from the **Apex SaaS** motionsites design."
- "Make a design system from this screenshot." → attach/paste an image

The assistant gets back design tokens, five components, a full-page layout, and a ready-to-open HTML preview — and can write the `.tsx` files straight into your project.

---

## 3. The four tools (reference)

| Tool | Input | Use it for |
|---|---|---|
| `generate_from_vibe` | `{ vibe: string }` | A plain-English description |
| `generate_from_url` | `{ url: string }` | Match an existing site's look |
| `generate_from_image` | `{ imageBase64: string, mimeType?: string }` | Match an image's color palette |
| `generate_from_motionsites` | `{ query: string, mode?: "closest" \| "list" \| "random" }` | Pull from 61 bundled production hero specs |

`generate_from_motionsites` modes: **`closest`** (default — best match, full generation), **`list`** (browse matches without generating), **`random`** (pick a random match).

Raw MCP call (only if you're scripting the protocol yourself):
```json
{ "name": "generate_from_vibe", "arguments": { "vibe": "dark luxury crypto dashboard" } }
```

---

## 4. What you get back

Every tool returns the **same five-output shape**:

```ts
{
  tokens,      // DesignTokens: colors, typography, spacing, motion, shadows, radius
  components,  // { Button, Card, Input, Navbar, StatCard } — each a TSX string
  layout,      // a full-page DemoPage.tsx string composing all components
  preview,     // a self-contained HTML document — open in any browser, no build step
  files,       // same as `components`, keyed by name for writing to disk
  source?      // (vibe + motionsites only) which preset / design drove it
}
```

Drop it into a React app:
1. Write each entry of `files` to `src/components/<Name>.tsx` (Button, Card, Input, Navbar, StatCard).
2. Write `layout` to `src/DemoPage.tsx`.
3. Write `preview` to `preview.html` and open it to see the design instantly.

---

## 5. Prerequisites for the generated code

The output is real React + Tailwind + Framer Motion, so in *your* project:

```bash
npm install framer-motion
```
- **Tailwind v3.4+** configured — every class is a standard utility.
- **Google Fonts** — the components reference families like `Space Grotesk` / `Inter`. Add them via `@import` or a `<link>`; `tokens.typography.fontFamily.{display,body,mono}` tells you which.

---

## 6. Notes & limits

- **Keyless.** Works with no API key. (Setting `OPENAI_API_KEY` on the server only refines vibes that match no built-in preset.)
- **Bundled library.** The 61 motionsites.ai specs ship with the server — fully offline, nothing is scraped at runtime.
- **Deterministic.** The same input always produces the same design system.
- **Public & unauthenticated.** The hosted URL is open to anyone who has it. For private use, self-host (section 1) or ask the maintainer to add a token check.
- **Output, not a library.** You copy the generated `.tsx` into your own app; there's no runtime dependency on skins-mcp.

---

Questions or issues → https://github.com/neromtoobad/skins
