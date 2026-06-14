/**
 * brand-cli scope --validate [--json]
 *
 * Reads .brand/.scope.json from the current working directory's .brand/
 * subdirectory and validates against schema/brand/scope.schema.json.
 *
 * Exits 0 on valid, 1 on invalid (or missing file). With --json, emits
 * structured stdout for embedded hosts.
 *
 * The command does not implement the merge — that lives in scope-merge.js
 * and is invoked by the SKILL at §0a.5.
 *
 * Spec: docs/superpowers/specs/2026-06-14-scope-json-design.md §4.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { loadScope, validateScope } from '../utils/scope-loader.js';

const SCOPE_REL_PATH = '.brand/.scope.json';

export async function scopeCommand(opts) {
  if (!opts.validate) {
    console.error(chalk.red('brand-cli scope: --validate is required (no other actions yet).'));
    process.exit(1);
  }

  const projectDir = process.cwd();
  const brandDir = join(projectDir, '.brand');

  if (!existsSync(brandDir)) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, error: 'no_brand_directory', path: SCOPE_REL_PATH }));
    } else {
      console.error(chalk.red(`No .brand/ directory at ${projectDir}.`));
    }
    process.exit(1);
  }

  let scope;
  try {
    scope = loadScope(brandDir);
  } catch (err) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, error: 'malformed_json', path: SCOPE_REL_PATH, message: err.message }));
    } else {
      console.error(chalk.red(err.message));
    }
    process.exit(1);
  }

  if (scope === null) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, error: 'no_scope_file', path: SCOPE_REL_PATH }));
    } else {
      console.error(chalk.red(`No ${SCOPE_REL_PATH} found at ${projectDir}.`));
    }
    process.exit(1);
  }

  const result = validateScope(scope);
  if (result.valid) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: true, path: SCOPE_REL_PATH }));
    } else {
      console.log(chalk.green(`✓ ${SCOPE_REL_PATH} is valid`));
    }
    return;
  }

  if (opts.json) {
    console.log(JSON.stringify({ ok: false, error: 'schema_validation_failed', path: SCOPE_REL_PATH, errorText: result.errorText }));
  } else {
    console.error(chalk.red(`✗ ${SCOPE_REL_PATH} failed schema validation:`));
    console.error(`  ${result.errorText}`);
  }
  process.exit(1);
}
