/**
 * src/scrapers/motionsites.ts
 *
 * Search engine over the bundled motionsites.ai prompt library.
 * All data is local — no network calls required.
 *
 * Exports: getPromptList, getPromptByName, getPromptsByCategory, searchPrompts
 */
import { MOTIONSITES_PROMPTS, type MotionsitesPrompt } from "./motionsites-data";

export type { MotionsitesPrompt };

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function scorePrompt(prompt: MotionsitesPrompt, query: string): number {
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  let score = 0;

  const nameLower = prompt.name.toLowerCase();
  const categoryLower = prompt.category.toLowerCase();
  const specLower = prompt.rawSpec.toLowerCase();
  const keywordStr = prompt.animationKeywords.join(" ").toLowerCase();
  const fontStr = prompt.fonts.join(" ").toLowerCase();

  // Exact name match — highest value
  if (nameLower === q) score += 10;

  for (const word of words) {
    if (word.length < 2) continue;
    // Name contains word
    if (nameLower.includes(word)) score += 3;
    // Category matches word
    if (categoryLower.includes(word)) score += 2;
    // Raw spec or keywords contain word
    if (specLower.includes(word)) score += 1;
    if (keywordStr.includes(word)) score += 1;
    if (fontStr.includes(word)) score += 1;
  }

  return score;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Return all prompts in the library. */
export function getPromptList(): MotionsitesPrompt[] {
  return MOTIONSITES_PROMPTS;
}

/** Find a prompt by exact name (case-insensitive). Returns null if not found. */
export function getPromptByName(name: string): MotionsitesPrompt | null {
  const lower = name.toLowerCase();
  return MOTIONSITES_PROMPTS.find(p => p.name.toLowerCase() === lower) ?? null;
}

/** Return all prompts in a given category (case-insensitive). */
export function getPromptsByCategory(category: string): MotionsitesPrompt[] {
  const lower = category.toLowerCase();
  return MOTIONSITES_PROMPTS.filter(p => p.category.toLowerCase().includes(lower));
}

/**
 * Search prompts by name, category, or keyword.
 * Returns results sorted by relevance score descending.
 * Always returns at least one result (the closest match).
 */
export function searchPrompts(query: string): Array<MotionsitesPrompt & { score: number }> {
  if (!query.trim()) {
    return MOTIONSITES_PROMPTS.map(p => ({ ...p, score: 0 }));
  }

  const scored = MOTIONSITES_PROMPTS.map(p => ({
    ...p,
    score: scorePrompt(p, query),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * Find the single best matching prompt for a query.
 * Falls back to the first entry if nothing scores > 0.
 */
export function findBestMatch(query: string): MotionsitesPrompt {
  const results = searchPrompts(query);
  return results[0];
}
