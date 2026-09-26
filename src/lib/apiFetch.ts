// Shared client-side response parser - fixes a recurring failure mode across "use client"
// components that call `await res.json()` unconditionally after `fetch()`: when a request
// never reaches the route's own handler at all (an expired/invalid session, or any other
// case that returns an HTML body instead of JSON - some /api/agent/* routes explicitly note
// "IIS replaces non-2xx bodies with a generic HTML page"), `res.json()` throws the browser's
// own cryptic "JSON.parse: unexpected character at line 1 column 1", with no indication of
// what actually went wrong.
//
// Reads the body as text and attempts JSON.parse directly, rather than pre-checking the
// Content-Type header (an earlier version of this fix did that in
// components/webAccessControl/RulesClient.tsx and it was too fragile - a genuine JSON error
// body occasionally arrived without a Content-Type this code trusted, masking the real,
// specific error message the server had already sent). Any response that IS valid JSON -
// 200, 400, or anything else - parses and returns normally; only a response that truly isn't
// JSON at all falls back to a friendly message instead of the raw browser parse error.
//
// No "use client" directive needed here - this has no React/DOM dependency of its own, just
// plain fetch() Response handling, so it's safe to import from both client components and
// (if ever useful) server code.
export async function parseJsonResponse(res: Response): Promise<{ ok: boolean; error?: string; data?: unknown }> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      res.status === 401 || res.status === 403 || res.status === 404
        ? "Your session may have expired. Please refresh the page and sign in again."
        : `Unexpected server response (HTTP ${res.status}). Please try again.`
    );
  }
}
