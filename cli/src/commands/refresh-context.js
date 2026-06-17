import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import chalk from 'chalk';
import { generateBrandContext } from '../utils/brand-context-generator.js';
import { loadBrandrc } from '../utils/brandrc-loader.js';

/**
 * Regenerate the project-root brand context file from .brand/.
 *
 * Default output: `brand.md` at project root. Any agent that loads root-level
 * brand files (Claude Code, Cursor, Copilot, etc.) reads it.
 *
 * Additional outputs:
 *  - `--also-write <path>` (repeatable): mirror brand.md to each path.
 *  - `outputs: [path, ...]` in .brandrc.yaml: same effect, declarative.
 *  - `--impeccable` (deprecated alias): equivalent to --also-write .impeccable.md.
 */
export async function refreshContextCommand(opts) {
  const projectDir = process.cwd();
  const cfg = loadBrandrc(projectDir);
  const brand = cfg.brand;
  let brandDir = cfg.brand_path
    ? resolve(projectDir, cfg.brand_path)
    : join(projectDir, '.brand');

  if (opts.brandPath) {
    brandDir = resolve(projectDir, opts.brandPath);
  }

  if (!existsSync(brandDir)) {
    console.log(chalk.red(`✗ Brand directory not found: ${brandDir}`));
    console.log(chalk.dim('  Run `brand-cli init` first, or pass --brand-path.'));
    process.exit(1);
  }

  const content = generateBrandContext(brandDir, brand);
  const outputs = [join(projectDir, 'brand.md')];

  if (opts.impeccable) {
    outputs.push(join(projectDir, '.impeccable.md'));
  }

  for (const outPath of outputs) {
    writeFileSync(outPath, content, 'utf-8');
    console.log(chalk.green(`✓ ${outPath.replace(projectDir + '/', '')} regenerated from ${brandDir.replace(projectDir + '/', '')}`));
  }

  if (opts.json) {
    console.log(JSON.stringify({ ok: true, brand_dir: brandDir, outputs, brand }, null, 2));
  }
}
