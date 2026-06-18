import chalk from 'chalk';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { weightsForTier } from '../utils/tier-weights.js';
import { classifyFile } from '../utils/file-status.js';
import { buildHealth, writeHealth } from '../utils/health-writer.js';
import { loadBrandrc } from '../utils/brandrc-loader.js';

function readManifest(brandDir) {
  const path = join(brandDir, 'manifest.json');
  if (!existsSync(path)) return null;
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
  if (parsed.version === '1') {
    console.error(chalk.red(
      'Found .brand/manifest.json with version: "1"; the contract is now version "2". '
      + 'Re-run /brand-context:extract (or brand-cli emit-manifest with the v2 stdin shape) '
      + 'to regenerate. See docs/superpowers/specs/2026-06-13-mcp-fallback-contract-design.md §4.'
    ));
    process.exit(1);
  }
  return parsed;
}

const TIER_DISPLAY = {
  minimum: ['overview.md', 'voice.md', 'tokens/colors.md', 'tokens/typography.md', 'tokens/spacing.md', 'tokens/motion.md', 'tokens/surfaces.md'],
  standard: ['composition/page-types.md', 'composition/patterns.md', 'composition/anti-patterns.md', 'CHANGELOG.md', 'conflicts.md'],
  comprehensive: ['workflows/figma-to-code.md', 'workflows/code-standards.md', 'workflows/deploy.md', 'workflows/qa-checklist.md'],
};

function labelForFile(path) {
  const labels = {
    'overview.md': 'Brand overview',
    'voice.md': 'Voice & tone',
    'tokens/colors.md': 'Color tokens',
    'tokens/typography.md': 'Typography tokens',
    'tokens/spacing.md': 'Spacing tokens',
    'tokens/motion.md': 'Motion tokens',
    'tokens/surfaces.md': 'Surface tokens',
    'composition/page-types.md': 'Page types',
    'composition/patterns.md': 'Composition patterns',
    'composition/anti-patterns.md': 'Anti-patterns',
    'CHANGELOG.md': 'Changelog',
    'conflicts.md': 'Conflicts',
    'workflows/figma-to-code.md': 'Figma-to-code workflow',
    'workflows/code-standards.md': 'Code standards',
    'workflows/deploy.md': 'Deploy workflow',
    'workflows/qa-checklist.md': 'QA checklist',
  };
  return labels[path] ?? path;
}

export async function scoreCommand(opts) {
  const projectDir = process.cwd();
  const brandDir = join(projectDir, '.brand');

  if (!existsSync(brandDir)) {
    console.log('');
    console.log(chalk.red('  No .brand/ directory found in the current directory.'));
    console.log(chalk.dim(`  Run ${chalk.cyan('brand-cli init')} first.`));
    console.log('');
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, error: 'no .brand/ directory' }));
    }
    return;
  }

  console.log('');
  console.log(chalk.bold('  brand-skills — Brand Package Score'));
  console.log('');

  const brandrc = loadBrandrc(projectDir);
  const tier = brandrc.tier ?? 'standard';
  // health-writer's `client` parameter is the persisted field name in .health.json
  // (decoupled from the brandrc rename, same asymmetry as manifest.client). Pass
  // brandrc's normalized `brand` value through.
  const client = brandrc.brand ?? '';
  const manifest = readManifest(brandDir);

  // Console output: unchanged tier-by-tier listing, but driven by classifyFile.
  const results = { tier: 'none', completeness: 0, files: {}, gaps: [] };
  let totalFiles = 0;
  let populatedFiles = 0;

  for (const [tierName, paths] of Object.entries(TIER_DISPLAY)) {
    console.log(chalk.bold(`  ${tierName.charAt(0).toUpperCase() + tierName.slice(1)} tier`));

    for (const path of paths) {
      totalFiles++;
      const abs = join(brandDir, path);
      const status = manifest?.files?.[path]?.status ?? classifyFile(abs);

      if (status === 'complete' || status === 'defaults') {
        const tag = status === 'defaults' ? chalk.dim(' (defaults — low confidence)') : '';
        console.log(chalk.green(`    ✓ ${labelForFile(path)}${tag}`));
        populatedFiles++;
        results.files[path] = status;
      } else if (status === 'partial' || status === 'placeholder') {
        console.log(chalk.yellow(`    ◐ ${labelForFile(path)} ${chalk.dim(`(${status})`)}`));
        results.files[path] = status;
        results.gaps.push(path);
      } else {
        console.log(chalk.dim(`    ○ ${labelForFile(path)}`));
        results.files[path] = 'missing';
        results.gaps.push(path);
      }
    }

    if (tierName === 'standard') {
      const componentsDir = join(brandDir, 'components');
      if (existsSync(componentsDir)) {
        const components = readdirSync(componentsDir).filter((f) => f.endsWith('.md'));
        if (components.length > 0) {
          console.log(chalk.green(`    ✓ ${components.length} component files`));
        } else {
          console.log(chalk.yellow('    ◐ components/ (empty)'));
          results.gaps.push('components/*.md');
        }
      }
    }

    console.log('');
  }

  const minimumComplete = TIER_DISPLAY.minimum.every((p) => {
    const s = manifest?.files?.[p]?.status ?? classifyFile(join(brandDir, p));
    return s === 'complete' || s === 'defaults';
  });
  const standardComplete = minimumComplete && TIER_DISPLAY.standard.every((p) => {
    const s = manifest?.files?.[p]?.status ?? classifyFile(join(brandDir, p));
    return s === 'complete' || s === 'defaults';
  });
  const comprehensiveComplete = standardComplete && TIER_DISPLAY.comprehensive.every((p) => {
    const s = manifest?.files?.[p]?.status ?? classifyFile(join(brandDir, p));
    return s === 'complete' || s === 'defaults';
  });

  if (comprehensiveComplete) results.tier = 'comprehensive';
  else if (standardComplete) results.tier = 'standard';
  else if (minimumComplete) results.tier = 'minimum';
  else results.tier = 'incomplete';

  results.completeness = Math.round((populatedFiles / totalFiles) * 100);

  const tierColor = results.tier === 'incomplete' ? chalk.red : chalk.green;
  console.log(chalk.bold('  Summary'));
  console.log(`    Tier: ${tierColor(results.tier)}`);
  console.log(`    Completeness: ${results.completeness}% (${populatedFiles}/${totalFiles} files populated)`);
  if (results.gaps.length > 0) {
    console.log(`    Gaps: ${results.gaps.length} files need content`);
  }
  console.log('');

  // Always emit .health.json.
  const health = buildHealth({ manifest, brandDir, tier, client });
  writeHealth(join(brandDir, '.health.json'), health);

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
  }
}
