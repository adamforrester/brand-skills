import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyFile } from '../../src/utils/file-status.js';

function withTmpFile(content, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'brand-test-'));
  const path = join(dir, 'test.md');
  if (content !== null) writeFileSync(path, content);
  try {
    return fn(path);
  } finally {
    rmSync(dir, { recursive: true });
  }
}

test('classifyFile returns missing when file does not exist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brand-test-'));
  try {
    assert.equal(classifyFile(join(dir, 'nope.md')), 'missing');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('classifyFile returns placeholder when scaffold marker present', () => {
  withTmpFile('# Title\n\n<!-- Fill this file following the schema at schema/foo.md -->\n', (p) => {
    assert.equal(classifyFile(p), 'placeholder');
  });
});

test('classifyFile returns placeholder when frontmatter is fully commented and body is short', () => {
  const content = '---\ncolors:\n  # primary: "#000000"\n  # neutral: "#FFFFFF"\n---\n\n# Title\n';
  withTmpFile(content, (p) => {
    assert.equal(classifyFile(p), 'placeholder');
  });
});

test('classifyFile returns complete when body has substantial content', () => {
  const content = '# Title\n\nThis is a fully populated document with more than fifty characters of body content.';
  withTmpFile(content, (p) => {
    assert.equal(classifyFile(p), 'complete');
  });
});

test('classifyFile returns complete when frontmatter has uncommented values', () => {
  const content = '---\ncolors:\n  primary: "#FF0000"\n---\n\n# Title\n\nShort body.\n';
  withTmpFile(content, (p) => {
    assert.equal(classifyFile(p), 'complete');
  });
});

test('classifyFile strips H1 and HTML comments before measuring body', () => {
  const content = '# Title\n<!-- comment one -->\n<!-- comment two -->\n\nshort\n';
  withTmpFile(content, (p) => {
    // Body after strip is just "short" (5 chars) — should be placeholder-equivalent
    // but no scaffold marker, no frontmatter, so falls into the body-length branch
    assert.equal(classifyFile(p), 'placeholder');
  });
});
