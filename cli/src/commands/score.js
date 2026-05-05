import chalk from 'chalk';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const TIER_FILES = {
  minimum: [
    { path: 'overview.md', label: 'Brand overview' },
    { path: 'voice.md', label: 'Voice & tone' },
    { path: 'tokens/colors.md', label: 'Color tokens' },
    { path: 'tokens/typography.md', label: 'Typography tokens' },
    { path: 'tokens/spacing.md', label: 'Spacing tokens' },
    { path: 'tokens/motion.md', label: 'Motion tokens' },
    { path: 'tokens/surfaces.md', label: 'Surface tokens' },
  ],
  standard: [
    { path: 'composition/page-types.md', label: 'Page types' },
    { path: 'composition/patterns.md', label: 'Composition patterns' },
    { path: 'composition/anti-patterns.md', label: 'Anti-patterns' },
    { path: 'CHANGELOG.md', label: 'Changelog' },
  ],
  comprehensive: [
    { path: 'workflows/figma-to-code.md', label: 'Figma-to-code workflow' },
    { path: 'workflows/code-standards.md', label: 'Code standards' },
    { path: 'workflows/deploy.md', label: 'Deploy workflow' },
    { path: 'workflows/qa-checklist.md', label: 'QA checklist' },
  ],
};

// Detect whether a brand file has real content vs. just init-scaffolded placeholders.
// A placeholder file has the marker `<!-- Fill this file following the schema...`
// and/or commented-out (#) frontmatter values. Real content has body prose and
// uncommented frontmatter values.
function hasContent(filePath) {
  if (!existsSync(filePath)) return false;
  const raw = readFileSync(filePath, 'utf-8');

  // The init scaffolder writes this exact placeholder marker into every fresh file.
  // If it's still present, the file hasn't been edited.
  if (raw.includes('<!-- Fill this file following the schema')) return false;

  // Strip frontmatter and inspect what's left.
  let body = raw;
  const trimmed = body.trimStart();
  if (trimmed.startsWith('---')) {
    const rest = trimmed.slice(3);
    const end = rest.indexOf('\n---');
    if (end !== -1) body = rest.slice(end + 4);
  }

  // Strip leading H1 ("# Title\n"), HTML comments, and blank lines.
  body = body
    .replace(/^#\s+[^\n]+\n+/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  // For token files, also check whether the YAML frontmatter has any uncommented
  // entries beyond the top-level key. If every value line starts with `#`, it's
  // still a placeholder regardless of body length.
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  if (fm) {
    const fmLines = fm[1].split('\n').filter(l => l.trim());
    const valueLines = fmLines.filter(l => /^\s+/.test(l));
    const allCommented = valueLines.length > 0 && valueLines.every(l => /^\s*#/.test(l));
    if (allCommented && body.length < 50) return false;
  }

  // Real content: substantial body or uncommented frontmatter values.
  return body.length >= 50;
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

  const results = { tier: 'none', completeness: 0, files: {}, gaps: [] };
  let totalFiles = 0;
  let populatedFiles = 0;

  for (const [tier, files] of Object.entries(TIER_FILES)) {
    console.log(chalk.bold(`  ${tier.charAt(0).toUpperCase() + tier.slice(1)} tier`));

    for (const file of files) {
      totalFiles++;
      const fullPath = join(brandDir, file.path);
      const exists = existsSync(fullPath);
      const populated = exists && hasContent(fullPath);

      if (populated) {
        console.log(chalk.green(`    ✓ ${file.label}`));
        populatedFiles++;
        results.files[file.path] = 'populated';
      } else if (exists) {
        console.log(chalk.yellow(`    ◐ ${file.label} ${chalk.dim('(exists but empty/placeholder)')}`));
        results.files[file.path] = 'placeholder';
        results.gaps.push(file.path);
      } else {
        console.log(chalk.dim(`    ○ ${file.label}`));
        results.files[file.path] = 'missing';
        results.gaps.push(file.path);
      }
    }

    // Check for component files (standard+ tier)
    if (tier === 'standard') {
      const componentsDir = join(brandDir, 'components');
      if (existsSync(componentsDir)) {
        const components = (await import('node:fs')).readdirSync(componentsDir)
          .filter(f => f.endsWith('.md'));
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

  // Determine achieved tier
  const minimumComplete = TIER_FILES.minimum.every(f => hasContent(join(brandDir, f.path)));
  const standardComplete = minimumComplete && TIER_FILES.standard.every(f => hasContent(join(brandDir, f.path)));
  const comprehensiveComplete = standardComplete && TIER_FILES.comprehensive.every(f => hasContent(join(brandDir, f.path)));

  if (comprehensiveComplete) results.tier = 'comprehensive';
  else if (standardComplete) results.tier = 'standard';
  else if (minimumComplete) results.tier = 'minimum';
  else results.tier = 'incomplete';

  results.completeness = Math.round((populatedFiles / totalFiles) * 100);

  // Summary
  const tierColor = results.tier === 'incomplete' ? chalk.red : chalk.green;
  console.log(chalk.bold('  Summary'));
  console.log(`    Tier: ${tierColor(results.tier)}`);
  console.log(`    Completeness: ${results.completeness}% (${populatedFiles}/${totalFiles} files populated)`);

  if (results.gaps.length > 0) {
    console.log(`    Gaps: ${results.gaps.length} files need content`);
  }
  console.log('');

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
  }
}
