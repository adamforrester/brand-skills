import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import chalk from 'chalk';
import { parse as yamlParse } from 'yaml';
import { generateBrandContext } from '../utils/brand-context-generator.js';

/**
 * Regenerate the project-root brand context file from .brand/.
 *
 * Default output: `brand.md` at project root. Any agent that loads root-level
 * brand files (Claude Code, Cursor, Copilot, Impeccable, etc.) reads it.
 *
 * If `--impeccable` is passed, additionally writes the same content to
 * `.impeccable.md` so the Impeccable skill picks it up under its conventional
 * filename.
 */
export async function refreshContextCommand(opts) {
  const projectDir = process.cwd();
  let client = projectDir.split('/').pop() || 'Brand';
  let brandDir = join(projectDir, '.brand');

  const brandrcPath = join(projectDir, '.brandrc.yaml');
  if (existsSync(brandrcPath)) {
    try {
      const cfg = yamlParse(readFileSync(brandrcPath, 'utf-8'));
      if (cfg?.client) client = cfg.client;
      if (cfg?.brand_path) brandDir = resolve(projectDir, cfg.brand_path);
    } catch (err) {
      console.log(chalk.yellow(`⚠ Could not parse .brandrc.yaml: ${err.message}`));
    }
  }

  if (opts.brandPath) {
    brandDir = resolve(projectDir, opts.brandPath);
  }

  if (!existsSync(brandDir)) {
    console.log(chalk.red(`✗ Brand directory not found: ${brandDir}`));
    console.log(chalk.dim('  Run `brand-cli init` first, or pass --brand-path.'));
    process.exit(1);
  }

  const content = generateBrandContext(brandDir, client);
  const outputs = [join(projectDir, 'brand.md')];

  if (opts.impeccable) {
    outputs.push(join(projectDir, '.impeccable.md'));
  }

  for (const outPath of outputs) {
    writeFileSync(outPath, content, 'utf-8');
    console.log(chalk.green(`✓ ${outPath.replace(projectDir + '/', '')} regenerated from ${brandDir.replace(projectDir + '/', '')}`));
  }

  if (opts.json) {
    console.log(JSON.stringify({ ok: true, brand_dir: brandDir, outputs, client }, null, 2));
  }
}
