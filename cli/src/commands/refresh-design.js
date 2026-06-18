import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import chalk from 'chalk';
import { generateDesignMd } from '../utils/design-md-generator.js';
import { generateStyleGuide } from '../utils/style-guide-generator.js';
import { loadBrandrc } from '../utils/brandrc-loader.js';

/**
 * Regenerate design.md at the project root from the project's .brand/.
 *
 * Resolves brand directory in this priority order:
 *   1. --brand-path CLI flag
 *   2. brand_path field in .brandrc.yaml
 *   3. ./.brand
 *
 * Brand name from .brandrc.yaml (`brand`, with `client` accepted as a deprecated alias);
 * falls back to basename(projectDir) when neither is set.
 */
export async function refreshDesignCommand(opts) {
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

  const designContent = generateDesignMd(brandDir, brand);
  const designPath = join(projectDir, 'design.md');
  writeFileSync(designPath, designContent, 'utf-8');
  console.log(chalk.green(`✓ design.md regenerated from ${brandDir}`));

  // Style guide HTML — sibling artifact, same overwrite policy as design.md.
  // Timestamp lives at the call site (not inside the generator) so the
  // generator stays pure and deterministic for SKILL/CLI byte-identical
  // parity. See spec §7a.
  const now = new Date().toISOString();
  const styleGuideContent = generateStyleGuide(brandDir, brand, now);
  const styleGuidePath = join(projectDir, 'style-guide.html');
  writeFileSync(styleGuidePath, styleGuideContent, 'utf-8');
  console.log(chalk.green(`✓ style-guide.html regenerated from ${brandDir}`));

  if (opts.json) {
    console.log(JSON.stringify({
      ok: true,
      brand_dir: brandDir,
      output: designPath,
      style_guide: styleGuidePath,
      brand,
    }, null, 2));
  }
}
