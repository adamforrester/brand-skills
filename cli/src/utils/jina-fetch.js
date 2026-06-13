/**
 * Jina Reader (r.jina.ai) HTTP client. Keyless GET; rate-limit-aware. Used as
 * the Stage 3 voice-extraction Tier 2 fallback when Playwright MCP is absent.
 * Spec: docs/superpowers/specs/2026-06-13-mcp-fallback-contract-design.md §3 jina-reader.
 */

const JINA_PREFIX = 'https://r.jina.ai/';

export class JinaFetchError extends Error {
  constructor(message, { code, status } = {}) {
    super(message);
    this.name = 'JinaFetchError';
    this.code = code;
    this.status = status;
  }
}

/**
 * GET https://r.jina.ai/<url>. Returns { ok: true, markdown } on 2xx.
 * Throws JinaFetchError on non-2xx, rate-limit, or network failure.
 *
 * opts.fetch — inject a fetch implementation (tests only). Defaults to globalThis.fetch.
 */
export async function fetchViaJina(url, opts = {}) {
  if (!url) throw new Error('fetchViaJina: url is required');
  const fetchImpl = opts.fetch ?? globalThis.fetch;

  let response;
  try {
    response = await fetchImpl(JINA_PREFIX + url);
  } catch (err) {
    throw new JinaFetchError(`network error fetching ${url} via Jina: ${err.message}`, { code: 'network_error' });
  }

  if (response.status === 429) {
    throw new JinaFetchError(`Jina Reader rate-limited (429) for ${url}`, { code: 'rate_limit', status: 429 });
  }
  if (!response.ok) {
    throw new JinaFetchError(`Jina Reader returned ${response.status} for ${url}`, { code: 'http_error', status: response.status });
  }

  const markdown = await response.text();
  return { ok: true, markdown };
}
