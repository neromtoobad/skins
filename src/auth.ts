/**
 * src/auth.ts — optional bearer/query token gate for the HTTP server.
 *
 * Pure + testable: the Express middleware in src/server.ts is a thin wrapper
 * around `isAuthorized`. When no token is configured the server is open
 * (backwards-compatible); when `SKINS_AUTH_TOKEN` is set, callers must supply
 * it via `Authorization: Bearer <token>` or `?token=<token>`.
 */

/** Extract a bearer token from an `Authorization` header value. */
export function bearerToken(authHeader: string | undefined): string | undefined {
  if (!authHeader) return undefined;
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() || undefined : undefined;
}

/**
 * True when the request is allowed.
 * - `expected` empty/undefined → open (no lock configured).
 * - otherwise the bearer header (preferred) or `?token=` must match exactly.
 */
export function isAuthorized(
  authHeader: string | undefined,
  queryToken: string | undefined,
  expected: string | undefined,
): boolean {
  if (!expected) return true;
  const provided = bearerToken(authHeader) ?? (queryToken || undefined);
  return provided === expected;
}
