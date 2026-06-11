# Extraction recipe — grow the reference library

This is how skins-mcp's curated library (`src/references/deep-references.ts`) grows
without hand-coding. Point it at great designs → produce a structured **DeepReference** →
validate + append. The richer this library, the more "insane" the vibe path (`generate_brief`)
gets. This is the product's moat and its freshness engine.

The extraction itself is done by an **agent** (Claude/Codex) following these steps — no paid
API, no runtime cost. The MCP server stays fast and keyless; the library just gets deeper.

---

## The loop (per reference)

1. **Pick a great design.** An Awwwards / Godly / Mobbin winner, a site you love, a competitor.
2. **Pull its DNA.** Call `generate_brief_from_url` with the URL — it returns the real palette,
   fonts, detected animation libraries, features (glass/gradient/3D), theme, radius, density.
   If you can screenshot it, also *look* at it (vision) to read the section structure and the
   one signature move.
3. **Fill the schema** (below) — synthesize the DNA + what you see into a `DeepReference`.
   The goal is a *blueprint a developer could build from*, not a description.
4. **Validate + append:**
   ```bash
   npm run add-reference -- path/to/candidate.json        # validate + append
   npm run add-reference -- path/to/candidate.json --check # validate only
   npx tsc --noEmit                                        # structural re-check of the whole library
   ```
5. **Commit.** `git add src/references/deep-references.ts && git commit -m "refs: add <id>"`
   then `railway up` (or push, if GitHub-connected) to ship it live.

A weekly version: ingest the week's Awwwards "Site of the Day" winners this way → the library
stays current → that's what justifies a subscription.

---

## The DeepReference schema (candidate JSON)

```jsonc
{
  "id": "ecommerce-product",          // kebab-case, unique
  "name": "Vitrine — Product Launch", // human label
  "category": "E-commerce",
  "keywords": ["ecommerce","store","product","shop","launch","retail","dtc","cart","checkout"],
  "summary": "One-line essence of the look.",
  "theme": "light",                   // "dark" | "light"
  "palette": {
    "background": "#faf8f5", "surface": "#ffffff", "foreground": "#141414",
    "primary": "#111111", "accent": "#ff5a3c",
    "hexes": ["#faf8f5","#141414","#ff5a3c","#e7e2da"]   // >= 3 real hexes from the site
  },
  "fonts": { "display": "Clash Display", "body": "Inter", "mono": "Space Mono",
             "note": "Why these — weights, pairing, tracking." },
  "motion": { "style": "smooth", "beats": ["reveal","image-zoom","sticky-add","count-up"] },
  "sections": [                        // >= 3; each is a buildable instruction
    { "name": "Hero", "detail": "Layout + key elements + motion in 1–2 sentences." },
    { "name": "Product grid", "detail": "..." },
    { "name": "Story / detail", "detail": "..." }
  ],
  "techniques": ["cinematic-hero","intersection-reveal","sticky-stack-cards","micro-interactions"],
  "signature": "The single distinctive move that defines this design."
}
```

### Field rules (enforced by `add-reference.mjs`)
- `id` kebab-case + unique; `theme` is `dark`|`light`.
- `keywords` ≥ 3 lowercase strings — these decide what vibes match it. Be generous and varied.
- `palette.*` and every `palette.hexes[]` must be `#rrggbb`. Use the **real** colors from the site.
- `sections` ≥ 3, each `{ name, detail }` — write them as build instructions, not adjectives.
- `techniques` ≥ 3, each from the toolkit below.

### Valid `techniques` (the toolkit in `src/generators/brief.ts`)
`cinematic-hero`, `3d-perspective-floor`, `gradient-shimmer-text`, `mouse-parallax`,
`cursor-spotlight`, `holo-foil-tilt`, `infinite-marquee`, `intersection-reveal`, `count-up`,
`draw-in-stroke`, `magnetic-hover`, `character-reveal`, `sticky-stack-cards`,
`glass-nav-condense`, `scroll-progress`, `texture-overlays`, `micro-interactions`

---

## What makes a *good* reference (quality bar)

- **Distinctive.** It should not blur into the others — a new archetype, not a recolor.
- **Real palette + type.** Pulled from an actual site, not invented.
- **Buildable sections.** Each `detail` tells you what to build and how it moves.
- **One signature move.** The memorable thing (a 3D pitch, a magnetic portrait, a typewriter terminal).
- **Generous keywords.** Cover the synonyms people will actually type.

Aim for breadth across categories (SaaS, sports, portfolio, luxury, fintech, web3, agency,
devtool, space, wellness, e-commerce, events, real-estate, music, news, education…).
