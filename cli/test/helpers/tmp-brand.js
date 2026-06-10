import { mkdtempSync, rmSync, cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURE_DIR = resolve(__dirname, '../fixtures');

/**
 * Copy a fixture into a fresh tmpdir. Returns { dir, brandDir, cleanup }.
 * Pass the fixture name (e.g. 'populated', 'fresh-init', 'mixed').
 */
export function withFixture(fixtureName) {
  const dir = mkdtempSync(join(tmpdir(), `brand-test-${fixtureName}-`));
  const src = join(FIXTURE_DIR, fixtureName);
  cpSync(src, dir, { recursive: true });
  return {
    dir,
    brandDir: join(dir, '.brand'),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/**
 * Make a tmpdir with an empty .brand/ and a minimal .brandrc.yaml.
 * Used when a test wants to control file creation explicitly.
 */
export function emptyBrandDir({ tier = 'minimum', client = 'acme' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'brand-test-empty-'));
  mkdirSync(join(dir, '.brand'), { recursive: true });
  writeFileSync(join(dir, '.brandrc.yaml'), `client: ${client}\ntier: ${tier}\nmode: ${tier}\nsources: {}\n`);
  return {
    dir,
    brandDir: join(dir, '.brand'),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
