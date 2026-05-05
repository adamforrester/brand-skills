import chalk from 'chalk';
import inquirer from 'inquirer';
import { tryRun } from '../utils/exec.js';

/**
 * One-shot helper: detect optional MCPs and offer to install Playwright if missing.
 *
 * brand-skills runs without MCPs — Stage 4 (multimodal), 5 (conflicts), 6 (DS
 * repo scan), 7 (design.md), 8 (.brand context) all work native. But Stage 2
 * (web tokens) needs Playwright for computed CSS, and Stage 3 (voice) is much
 * richer with Playwright's accessibility-tree snapshots than with WebFetch.
 *
 * Playwright MCP needs no signup and no API key — single command, ~30 seconds.
 * We surface that here.
 */
export async function setupCommand(opts) {
  console.log('');
  console.log(chalk.bold('  brand-skills — Setup Helper'));
  console.log(chalk.dim('  Detects optional MCPs and helps install Playwright (recommended).'));
  console.log('');

  // Node + Claude Code presence
  const node = tryRun('node -v');
  if (!node.ok) {
    console.log(chalk.red('✗ Node.js not detected. Install from https://nodejs.org (LTS).'));
    process.exit(1);
  }
  console.log(chalk.green(`✓ Node.js ${node.stdout}`));

  const claude = tryRun('claude --version');
  if (!claude.ok) {
    console.log(chalk.yellow('⚠ Claude Code not detected.'));
    console.log(chalk.dim('  Install: npm install -g @anthropic-ai/claude-code'));
    console.log(chalk.dim('  brand-cli works without it for the CLI commands; the slash commands need Claude Code.'));
  } else {
    console.log(chalk.green(`✓ Claude Code ${claude.stdout}`));
  }
  console.log('');

  // Detect Playwright MCP
  const list = tryRun('claude mcp list');
  const hasPlaywright = list.ok && /^playwright:/m.test(list.stdout);
  const hasFigmaConsole = list.ok && /^figma-console:/m.test(list.stdout);

  console.log(chalk.bold('  MCP detection'));
  console.log(`  ${hasPlaywright ? chalk.green('✓') : chalk.yellow('○')} Playwright MCP ${hasPlaywright ? '— full quality token + voice extraction' : '— not installed'}`);
  console.log(`  ${hasFigmaConsole ? chalk.green('✓') : chalk.dim('○')} Figma Console MCP ${hasFigmaConsole ? '— Figma variable extraction' : '— not installed (optional, only needed when Figma is a source)'}`);
  console.log('');

  if (hasPlaywright) {
    console.log(chalk.green.bold('  All set.'));
    console.log(chalk.dim('  Run `/brand-extract` in Claude Code, or `brand-cli init` to scaffold a project.'));
    console.log('');
    return;
  }

  // Offer to install Playwright
  console.log(chalk.bold('  Recommended: install Playwright MCP'));
  console.log(chalk.dim('  No signup, no API key. ~30 seconds. Without it, Stage 2 (web token extraction) is skipped'));
  console.log(chalk.dim('  and Stage 3 (voice extraction) falls back to WebFetch — usable but coarser.'));
  console.log('');

  if (!claude.ok) {
    console.log(chalk.dim('  (Claude Code not detected — skipping install offer.)'));
    return;
  }

  const { install } = await inquirer.prompt([
    { type: 'confirm', name: 'install', message: 'Install Playwright MCP now?', default: true },
  ]);

  if (!install) {
    console.log(chalk.dim('  Skipped. Install later with: claude mcp add playwright -s user -- npx -y @playwright/mcp@latest'));
    return;
  }

  console.log(chalk.dim('  Running: claude mcp add playwright -s user -- npx -y @playwright/mcp@latest'));
  const result = tryRun('claude mcp add playwright -s user -- npx -y @playwright/mcp@latest');
  if (result.ok) {
    console.log(chalk.green('✓ Playwright MCP installed.'));
    console.log(chalk.dim('  First run will download the Chromium browser (~few hundred MB) and may take a minute.'));
  } else {
    console.log(chalk.red('✗ Install failed.'));
    if (result.stderr) console.log(chalk.dim(`  ${result.stderr.split('\n')[0]}`));
  }
  console.log('');

  if (opts.json) {
    console.log(JSON.stringify({ ok: result.ok, playwright: hasPlaywright || result.ok, figma_console: hasFigmaConsole }, null, 2));
  }
}
