#!/usr/bin/env node

import { program } from 'commander';
import { initCommand } from '../src/commands/init.js';
import { setupCommand } from '../src/commands/setup.js';
import { refreshDesignCommand } from '../src/commands/refresh-design.js';
import { refreshContextCommand } from '../src/commands/refresh-context.js';
import { scoreCommand } from '../src/commands/score.js';

program
  .name('brand-cli')
  .description('Standalone CLI for the brand-skills toolkit — scaffold .brand/, regenerate root artifacts, score completeness')
  .version('0.3.0');

program
  .command('setup')
  .description('Detect optional MCPs and offer to install Playwright (recommended for full extraction quality)')
  .option('--json', 'Output results as JSON')
  .action(setupCommand);

program
  .command('init')
  .description('Scaffold a new client project: .brand/, .brandrc.yaml, brand.md, design.md')
  .option('--client <name>', 'Client name (non-interactive when set)')
  .option('--mode <mode>', 'standard | pitch | comprehensive', 'standard')
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
  .description('Regenerate brand.md (and optionally .impeccable.md) at project root from .brand/')
  .option('--brand-path <path>', 'Override path to .brand/ directory')
  .option('--impeccable', 'Also write .impeccable.md (same content as brand.md, Impeccable-conventional filename)')
  .option('--json', 'Output results as JSON')
  .action(refreshContextCommand);

program
  .command('score')
  .description('Report .brand/ package completeness against the schema')
  .option('--json', 'Output results as JSON')
  .action(scoreCommand);

program.parse();
