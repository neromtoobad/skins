# Design note / ADR — the brief engine

**Status:** accepted, shipped (v0.3.0 → v0.8.2). **Supersedes** the token-only output as the primary path.

## Context

The original product returned a fixed five-output bundle — `DesignTokens` + 5 templated TSX
components (`Button/Card/Input/Navbar/StatCard`) + layout + preview. It was deterministic and
type-safe, but every input collapsed to ~10 token values, so **every output looked the same**:
generic, indigo-on-near-black, lightly animated. Pointing it at a football app produced violet SaaS
primitives. The thing that makes a design great — bespoke layout, real motion, distinctive colour,
imagery — was thrown away.

## Decision

Add a **brief engine**: instead of returning finished code, return a **build directive** — a prompt
that instructs the calling model (Claude, Codex) to *build the page itself*. The MCP becomes the
**curator + quality bar**, not a code printer. A brief carries:

1. a **rebuild-from-scratch order** (redesigns must not tint the existing design);
2. a **distinctive, non-slop palette** as a paste-ready `:root` token block;
3. a **section-by-section blueprint** from a curated reference (or extracted from a live URL);
4. a **technique toolkit** + an **anti-AI-slop colour rule**;
5. **required motion** with paste-ready `IntersectionObserver` / count-up / parallax code;
6. an **image asset plan** (generation prompts + free-stock fallbacks).

Two surfaces consume it: `generate_brief` (vibe → curated blueprint) and `generate_brief_from_url`
(any site → its extracted design DNA).

## Why this shape

- **Code beats prose.** Handing the model real CSS tokens and real motion code (not descriptions)
  is the strongest lever to actually change colour and add motion — verified in `test/brief.test.ts`.
- **The model is the renderer.** Quality scales with model capability instead of with how many
  templates we hand-write.
- **The library is the moat.** Value = depth × breadth × freshness of references, grown on rails via
  the extraction pipeline (`scripts/add-reference.mjs` + `docs/EXTRACTION_RECIPE.md`).

## Alternatives considered

- **Keep expanding the template generators.** Rejected — a treadmill that never matches a model
  cooking freely; output stays "kit-like."
- **Server-side image generation (Higgsfield Cloud API).** Built behind a key gate, then **binned** —
  it needs separately-funded API credits and would bill on a public server. Image generation stays
  agent-side (free via the Higgsfield MCP) through the asset plan.
- **Live web scraping of design galleries (Pinterest/Awwwards) at call time.** Rejected — ToS
  issues, rotting URLs, latency. We extract *design DNA/patterns* from a user-supplied URL and
  curate references offline instead.

## Consequences

- **Upside:** dramatically more distinctive, animated, on-brand output; the differentiator.
- **Trade-off:** the MCP returns instructions — it cannot *force* the model to comply. Mitigated by
  the blunt rebuild order, the concrete token block, and enforced motion code (the three strongest
  levers a tool has). A model that ignores all three is disobeying an explicit instruction, which no
  tool can override.
- **Compatibility:** the four design-system generators are unchanged; the brief engine is additive.
