/**
 * brand-cli import-tokens — ingest assets/*.tokens.json (DTCG) and print
 * merged token state as JSON to stdout. Stage 1 fallback path when
 * figma-console MCP is absent. The SKILL writes the token files; this
 * command is a pure projection.
 *
 * Spec: docs/superpowers/specs/2026-06-13-mcp-fallback-contract-design.md
 *       §3 dtcg-tokens-file, §6 (CLI layer).
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';
import chalk from 'chalk';
import { importDtcgFiles } from '../utils/dtcg-import.js';

const ASSETS_DIR = 'assets';
const TOKEN_GLOB_SUFFIX = '.tokens.json';

function findTokenFiles(projectDir) {
  const dir = join(projectDir, ASSETS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(TOKEN_GLOB_SUFFIX))
    .sort()
    .map((f) => join(dir, f));
}

export async function importTokensCommand(opts) {
  const projectDir = process.cwd();

  let files;
  if (opts.file) {
    const abs = isAbsolute(opts.file) ? opts.file : resolve(projectDir, opts.file);
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      console.error(chalk.red(`File not found: ${opts.file}`));
      process.exit(1);
    }
    files = [abs];
  } else {
    files = findTokenFiles(projectDir);
    if (files.length === 0) {
      console.error(chalk.red(
        `No DTCG token files found at ${ASSETS_DIR}/*${TOKEN_GLOB_SUFFIX}. `
        + `Export tokens from a DTCG-compatible Figma plugin (e.g. Token Press) and drop the JSON into ./${ASSETS_DIR}/.`
      ));
      process.exit(1);
    }
  }

  let merged;
  try {
    merged = importDtcgFiles(files);
  } catch (err) {
    console.error(chalk.red(`DTCG parse error: ${err.message}`));
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(merged, null, 2) + '\n');
}
