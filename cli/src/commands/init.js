import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { stringify as yamlStringify } from 'yaml';
import { generateDesignMd } from '../utils/design-md-generator.js';
import { generateStyleGuide } from '../utils/style-guide-generator.js';
import { generateBrandContext } from '../utils/brand-context-generator.js';
import { warnDeprecated } from '../utils/deprecations.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SCHEMA_DIR = resolve(__dirname, '../../../schema/brand');

const BRAND_FILES = {
  minimum: [
    'overview.md',
    'voice.md',
    'tokens/colors.md',
    'tokens/typography.md',
    'tokens/spacing.md',
    'tokens/motion.md',
    'tokens/surfaces.md',
  ],
  standard: [
    'components/.gitkeep',
    'composition/page-types.md',
    'composition/patterns.md',
    'composition/anti-patterns.md',
    'CHANGELOG.md',
    'conflicts.md',
  ],
  comprehensive: [
    'workflows/figma-to-code.md',
    'workflows/code-standards.md',
    'workflows/deploy.md',
    'workflows/qa-checklist.md',
    'workflows/build-sequence.md',
    'specs/.gitkeep',
  ],
};

const TIER_FOR_MODE = {
  'public-sources-only': 'minimum',
  pitch: 'minimum', // deprecated alias; loader normalizes but init's --mode also accepts
  standard: 'standard',
  comprehensive: 'comprehensive',
};

const PUBLIC_SOURCES_ONLY_DISCLAIMER =
  '> ⚠️ **PUBLIC-SOURCES-ONLY MODE** — derived from public sources only. Not validated against internal brand standards.\n\n';

const TOKEN_FRONTMATTER = {
  'tokens/colors.md': `---\ncolors:\n  # primary: "#000000"\n  # neutral: "#FFFFFF"\n  # error: "#D32F2F"\n---\n\n`,
  'tokens/typography.md': `---\ntypography:\n  # body-md:\n  #   fontFamily: Inter\n  #   fontSize: 16px\n  #   fontWeight: 400\n  #   lineHeight: 1.6\n---\n\n`,
  'tokens/spacing.md': `---\nspacing:\n  # base: 16px\n  # xs: 4px\n  # sm: 8px\n  # md: 16px\n  # lg: 32px\n---\n\n`,
  'tokens/surfaces.md': `---\nrounded:\n  # sm: 4px\n  # md: 8px\nelevation:\n  # flat: none\n  # md: "0 4px 8px rgba(0,0,0,0.06)"\n---\n\n`,
};

export async function initCommand(opts) {
  const results = { created: [], tier: '', mode: '', brand: '' };
  const projectDir = process.cwd();

  console.log('');
  console.log(chalk.bold('  brand-skills — Project Setup'));
  console.log('');

  const answers = {};
  const dirnameDefault = basename(projectDir) || 'Brand';
  if (opts.brand) {
    answers.brand = opts.brand;
  } else if (opts.client) {
    warnDeprecated(
      'init.flag.client',
      '--client is deprecated; use --brand instead. The alias is read but will be removed in 2.0.'
    );
    answers.brand = opts.client;
  } else {
    const { brand } = await inquirer.prompt([
      {
        type: 'input',
        name: 'brand',
        message: 'Brand name:',
        default: dirnameDefault,
        validate: v => v.trim().length > 0 || 'Required',
      },
    ]);
    answers.brand = brand.trim();
  }

  if (opts.mode && ['standard', 'public-sources-only', 'pitch', 'comprehensive'].includes(opts.mode)) {
    if (opts.mode === 'pitch') {
      warnDeprecated(
        'init.flag.mode.pitch',
        '--mode pitch is deprecated; use --mode public-sources-only instead. The alias is read but will be removed in 2.0.'
      );
      answers.mode = 'public-sources-only';
    } else {
      answers.mode = opts.mode;
    }
  } else if (!opts.mode || opts.mode === 'standard') {
    const { mode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: 'Project mode:',
        choices: [
          { name: `standard             ${chalk.dim('— You have brand assets: style guide, Figma, live site')}`, value: 'standard' },
          { name: `public-sources-only  ${chalk.dim('— Public sources only: website, social, no internal access')}`, value: 'public-sources-only' },
          { name: `comprehensive        ${chalk.dim('— Full access plus institutional knowledge capture')}`, value: 'comprehensive' },
        ],
        default: 'standard',
      },
    ]);
    answers.mode = mode;
  } else {
    answers.mode = opts.mode;
  }

  const tier = TIER_FOR_MODE[answers.mode];
  results.tier = tier;
  results.mode = answers.mode;
  results.brand = answers.brand;

  // Detect existing files
  const existing = ['.brand', '.brandrc.yaml', 'brand.md', 'design.md', 'style-guide.html'].filter(f => existsSync(join(projectDir, f)));
  if (existing.length > 0 && !opts.force) {
    console.log(chalk.yellow('  Existing files detected:'));
    for (const f of existing) console.log(chalk.yellow(`    - ${f}`));
    console.log('');
    if (opts.brand || opts.client) {
      console.log(chalk.red('  Aborting: existing files would be overwritten.'));
      console.log(chalk.dim('  Re-run with --force to overwrite, or run from an empty directory.'));
      process.exit(1);
    }
    const { proceed } = await inquirer.prompt([
      { type: 'confirm', name: 'proceed', message: 'Overwrite these files?', default: false },
    ]);
    if (!proceed) {
      console.log(chalk.dim('  Aborted. No files were changed.'));
      return;
    }
  }

  console.log(chalk.bold(`  Scaffolding ${answers.brand} (${answers.mode} mode)`));
  console.log('');

  // 1. .brand/ directory
  const brandDir = join(projectDir, '.brand');
  scaffoldBrandDirectory(brandDir, tier, answers.mode === 'public-sources-only');
  results.created.push('.brand/');
  console.log(chalk.green(`✓ .brand/ (${tier} tier)`));

  // 2. .brandrc.yaml
  const brandrc = {
    brand: answers.brand,
    tier,
    mode: answers.mode,
    sources: {},
  };
  writeFileSync(join(projectDir, '.brandrc.yaml'), yamlStringify(brandrc), 'utf-8');
  console.log(chalk.green('✓ .brandrc.yaml'));
  results.created.push('.brandrc.yaml');

  // 3. brand.md (project-root context, generated from .brand/ — placeholder shape)
  writeFileSync(join(projectDir, 'brand.md'), generateBrandContext(brandDir, answers.brand), 'utf-8');
  console.log(chalk.green('✓ brand.md'));
  results.created.push('brand.md');

  // 4. design.md (spec-compliant, generated from .brand/)
  writeFileSync(join(projectDir, 'design.md'), generateDesignMd(brandDir, answers.brand), 'utf-8');
  console.log(chalk.green('✓ design.md (design.md spec)'));
  results.created.push('design.md');

  // 5. style-guide.html (sibling artifact, same overwrite policy as design.md)
  const now = new Date().toISOString();
  writeFileSync(join(projectDir, 'style-guide.html'), generateStyleGuide(brandDir, answers.brand, now), 'utf-8');
  console.log(chalk.green('✓ style-guide.html'));
  results.created.push('style-guide.html');

  // 6. asset directory (default ./assets, override via --asset-dir or sources.asset_dir).
  // Records the chosen path on .brandrc.yaml's sources.asset_dir so the SKILL's Stage 0
  // scan honors the override on subsequent runs.
  // Normalize a leading `./` from --asset-dir input so the path renders cleanly
  // in the success log + Next steps output (which prepend `./` themselves) and
  // is persisted to brandrc as a relative path without redundant slashes.
  const assetDirRel = (opts.assetDir || 'assets').replace(/^\.\//, '');
  const assetsDir = join(projectDir, assetDirRel);
  if (!existsSync(assetsDir)) {
    mkdirSync(assetsDir, { recursive: true });
    writeFileSync(
      join(assetsDir, 'README.md'),
      [
        '# Brand assets',
        '',
        'Drop brand assets here — `/brand-context:extract` (in Claude Code) will discover and use them automatically.',
        '',
        '**Supported:**',
        '- `.pdf` — brand guides, style guides, voice docs',
        '- `.png` / `.jpg` / `.jpeg` / `.webp` / `.gif` — reference screenshots',
        '- `.svg` — logos, hero assets',
        '',
        '**Not directly readable** (export to PDF first):',
        '- `.docx` / `.pptx` / `.key` / `.numbers`',
        '',
        "You don't need to edit `.brandrc.yaml` by hand — the skill scans this directory, classifies what it finds, and asks you to confirm before extracting.",
        '',
      ].join('\n'),
      'utf-8'
    );
    console.log(chalk.green(`✓ ${assetDirRel}/ (drop brand files here)`));
    results.created.push(`${assetDirRel}/`);
  }
  if (assetDirRel !== 'assets') {
    // Persist the override into sources.asset_dir so subsequent SKILL runs honor it.
    brandrc.sources.asset_dir = assetDirRel;
    writeFileSync(join(projectDir, '.brandrc.yaml'), yamlStringify(brandrc), 'utf-8');
  }

  console.log('');
  console.log(chalk.bold('  Next steps'));
  console.log('');
  console.log(`  1. Drop brand assets (PDFs, screenshots, logos) into ${chalk.cyan(`./${assetDirRel}/`)}`);
  console.log(`  2. In Claude Code, run ${chalk.cyan('/brand-context:extract')} — the skill scans assets, asks for any URLs (website, Figma, social), and runs the pipeline`);
  console.log(`  3. After editing ${chalk.cyan('.brand/')} files manually, re-run ${chalk.cyan('brand-cli refresh-design')} / ${chalk.cyan('brand-cli refresh-context')} to regenerate root artifacts`);
  console.log('');

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
  }
}

function scaffoldBrandDirectory(brandDir, tier, isPublicSourcesOnly) {
  const filesToCreate = [...BRAND_FILES.minimum];
  if (tier === 'standard' || tier === 'comprehensive') filesToCreate.push(...BRAND_FILES.standard);
  if (tier === 'comprehensive') filesToCreate.push(...BRAND_FILES.comprehensive);

  for (const filePath of filesToCreate) {
    const fullPath = join(brandDir, filePath);
    mkdirSync(join(fullPath, '..'), { recursive: true });

    if (filePath.endsWith('.gitkeep')) {
      writeFileSync(fullPath, '', 'utf-8');
      continue;
    }

    const name = filePath.replace(/\.md$/, '').split('/').pop();
    const title = name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');
    const schemaRef = `schema/brand/${filePath.replace(/\//g, '-').replace('.md', '')}.schema.md`;
    const frontmatter = TOKEN_FRONTMATTER[filePath] || '';
    let content = frontmatter + `# ${title}\n\n<!-- Fill this file following the schema at ${schemaRef} -->\n`;
    if (isPublicSourcesOnly) content = PUBLIC_SOURCES_ONLY_DISCLAIMER + content;
    writeFileSync(fullPath, content, 'utf-8');
  }
}
