#!/usr/bin/env node

import { program } from 'commander';
import { initCommand } from '../src/commands/init.js';
import { setupCommand } from '../src/commands/setup.js';
import { refreshDesignCommand } from '../src/commands/refresh-design.js';
import { refreshContextCommand } from '../src/commands/refresh-context.js';
import { scoreCommand } from '../src/commands/score.js';
import { emitManifestCommand } from '../src/commands/emit-manifest.js';
import { importTokensCommand } from '../src/commands/import-tokens.js';
import { scopeCommand } from '../src/commands/scope.js';

function collectAlsoWrite(value, previous) {
  return previous.concat([value]);
}

program
  .name('brand-cli')
  .description('Standalone CLI for the brand-skills toolkit — scaffold .brand/, regenerate root artifacts, score completeness')
  .version('0.5.0');

program
  .command('setup')
  .description('Detect optional MCPs and offer to install Playwright (recommended for full extraction quality)')
  .option('--json', 'Output results as JSON')
  .action(setupCommand);

program
  .command('init')
  .description('Scaffold a new project: .brand/, .brandrc.yaml, brand.md, design.md')
  .option('--brand <name>', 'Brand name (non-interactive when set)')
  .option('--client <name>', 'Deprecated alias of --brand; will be removed in 2.0')
  .option('--asset-dir <path>', 'Directory to create for brand assets (default: ./assets)')
  .option('--mode <mode>', 'standard | public-sources-only | comprehensive (pitch is a deprecated alias of public-sources-only)', 'standard')
  .option('--force', 'Overwrite existing .brand/, brand.md, design.md without prompting')
  .option('--json', 'Output results as JSON')
  .action(initCommand);

program
  .command('refresh-design')
  .description('Regenerate design.md at project root from .brand/')
  .option('--brand-path <path>', 'Override path to .brand/ directory')
  .option('--json', 'Output results as JSON')
  .action(refreshDesignCommand);

program
  .command('refresh-context')
  .description('Regenerate brand.md at project root from .brand/, optionally mirroring to additional paths')
  .option('--brand-path <path>', 'Override path to .brand/ directory')
  .option('--also-write <path>', 'Mirror brand.md to an additional path (repeatable)', collectAlsoWrite, [])
  .option('--impeccable', 'Deprecated alias of --also-write .impeccable.md; will be removed in 2.0')
  .option('--json', 'Output results as JSON')
  .action(refreshContextCommand);

program
  .command('score')
  .description('Report .brand/ package completeness against the schema')
  .option('--json', 'Output results as JSON')
  .action(scoreCommand);

program
  .command('emit-manifest')
  .description('Emit .brand/manifest.json from .brand/ + stage data on stdin')
  .option('--dry-run', 'Print manifest to stdout instead of writing to disk')
  .option('--json', 'Output result as JSON')
  .action(emitManifestCommand);

program
  .command('import-tokens')
  .description('Ingest DTCG token files (assets/*.tokens.json) and print merged token state as JSON. Stage 1 fallback when figma-console MCP is absent.')
  .option('--file <path>', 'Read exactly this file instead of scanning assets/')
  .action(importTokensCommand);

program
  .command('scope')
  .description('Validate .brand/.scope.json against the scope schema. Pre-flight check for embedded hosts before dispatching the SKILL.')
  .option('--validate', 'Validate the scope file (currently the only supported action)')
  .option('--json', 'Emit structured JSON output to stdout instead of human-readable text')
  .action(scopeCommand);

program.parse();
