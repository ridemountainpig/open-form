import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { inlineScriptHashes, pageHeaders } from './server.ts';

const sha = (text: string) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;

describe('inlineScriptHashes', () => {
  it('hashes inline scripts and skips ones loaded by src', () => {
    const html = `<script>(() => 1)()</script><script type="module" crossorigin src="/assets/a.js"></script><script type="module">x</script>`;
    expect(inlineScriptHashes(html)).toEqual([sha('(() => 1)()'), sha('x')]);
  });
});

describe('pageHeaders', () => {
  it('lets Studio run only its build and the inline scripts of its shell', () => {
    const csp = pageHeaders('studio', {}, { scriptHashes: ["'sha256-abc'"] })[
      'content-security-policy'
    ];
    expect(csp).toBe(
      "frame-ancestors 'self'; script-src 'self' 'sha256-abc'; object-src 'none'; base-uri 'self'",
    );
  });

  it('keeps Studio out of search results but leaves forms indexable', () => {
    expect(pageHeaders('studio', {})['x-robots-tag']).toBe('noindex, nofollow');
    expect(pageHeaders('form', {})['x-robots-tag']).toBeUndefined();
  });

  it('leaves scripts on form pages alone and frames them per embed.origins', () => {
    const headers = pageHeaders('form', { embed: { origins: ['https://blog.example'] } });
    expect(headers['content-security-policy']).toBe("frame-ancestors 'self' https://blog.example");
    expect(headers['x-frame-options']).toBeUndefined();
  });

  it('sends HSTS only to browsers already on HTTPS', () => {
    for (const page of ['studio', 'form'] as const) {
      expect(pageHeaders(page, {})['strict-transport-security']).toBeUndefined();
      expect(pageHeaders(page, {}, { https: true })['strict-transport-security']).toBe(
        'max-age=31536000',
      );
    }
  });
});
