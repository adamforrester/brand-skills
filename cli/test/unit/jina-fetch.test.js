import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchViaJina, JinaFetchError } from '../../src/utils/jina-fetch.js';

function fakeFetch(impl) {
  return async (url, init) => impl(url, init);
}

test('fetchViaJina builds the r.jina.ai URL and returns markdown on 200', async () => {
  let seenUrl = null;
  const fetch = fakeFetch(async (url) => {
    seenUrl = url;
    return {
      ok: true,
      status: 200,
      text: async () => '# Hello\n\nWorld\n',
    };
  });

  const result = await fetchViaJina('https://example.com/about', { fetch });
  assert.equal(result.ok, true);
  assert.equal(result.markdown, '# Hello\n\nWorld\n');
  assert.equal(seenUrl, 'https://r.jina.ai/https://example.com/about');
});

test('fetchViaJina throws JinaFetchError(rate_limit) on 429', async () => {
  const fetch = fakeFetch(async () => ({ ok: false, status: 429, text: async () => '' }));
  await assert.rejects(
    () => fetchViaJina('https://example.com', { fetch }),
    (err) => err instanceof JinaFetchError && err.code === 'rate_limit' && err.status === 429
  );
});

test('fetchViaJina throws JinaFetchError(http_error) on 5xx', async () => {
  const fetch = fakeFetch(async () => ({ ok: false, status: 503, text: async () => 'Service Unavailable' }));
  await assert.rejects(
    () => fetchViaJina('https://example.com', { fetch }),
    (err) => err instanceof JinaFetchError && err.code === 'http_error' && err.status === 503
  );
});

test('fetchViaJina throws JinaFetchError(network_error) on fetch reject', async () => {
  const fetch = fakeFetch(async () => { throw new Error('ECONNREFUSED'); });
  await assert.rejects(
    () => fetchViaJina('https://example.com', { fetch }),
    (err) => err instanceof JinaFetchError && err.code === 'network_error'
  );
});

test('fetchViaJina rejects empty url early without calling fetch', async () => {
  let called = false;
  const fetch = fakeFetch(async () => { called = true; return { ok: true, status: 200, text: async () => '' }; });
  await assert.rejects(() => fetchViaJina('', { fetch }), /url is required/);
  assert.equal(called, false);
});
