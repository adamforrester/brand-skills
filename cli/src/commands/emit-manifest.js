import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { writeManifest, validateManifest } from '../utils/manifest-writer.js';
import { weightsForTier } from '../utils/tier-weights.js';
import { classifyFile } from '../utils/file-status.js';
import { loadContract, getDependency } from '../utils/contract-loader.js';
import { loadBrandrc } from '../utils/brandrc-loader.js';

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function generatorString() {
  const pkgPath = new URL('../../../package.json', import.meta.url);
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return `brand-cli@${pkg.version}`;
}

function listExistingComponentFiles(brandDir) {
  const dir = join(brandDir, 'components');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'inventory.md')
    .map((f) => `components/${f}`);
}

function buildFilesMap({ brandDir, tier, stageOverrides }) {
  const weights = weightsForTier(tier);
  const files = {};

  for (const path of Object.keys(weights)) {
    const abs = join(brandDir, path);
    const status = classifyFile(abs);
    const entry = { status };
    if (status !== 'missing' && existsSync(abs)) {
      entry.bytes = statSync(abs).size;
    }
    files[path] = entry;
  }

  const universe = weightsForTier('comprehensive');
  for (const path of Object.keys(universe)) {
    if (files[path]) continue;
    const abs = join(brandDir, path);
    if (!existsSync(abs)) continue;
    files[path] = { status: classifyFile(abs), bytes: statSync(abs).size };
  }

  if (tier === 'comprehensive') {
    for (const path of listExistingComponentFiles(brandDir)) {
      const abs = join(brandDir, path);
      files[path] = { status: classifyFile(abs), bytes: statSync(abs).size };
    }
  }

  for (const [path, override] of Object.entries(stageOverrides ?? {})) {
    if (!files[path]) {
      const abs = join(brandDir, path);
      files[path] = existsSync(abs)
        ? { status: classifyFile(abs), bytes: statSync(abs).size }
        : { status: 'missing' };
    }
    if (override.status) files[path].status = override.status;
    if (override.note) files[path].note = override.note;
  }

  return files;
}

const VALID_TIERS = ['minimum', 'standard', 'comprehensive'];

function rejectV1(input) {
  if (input.version === '1') {
    return 'manifest input uses version "1" shape — the contract is now version "2" '
      + '(see docs/superpowers/specs/2026-06-13-mcp-fallback-contract-design.md §4). '
      + 'Rename mcps -> dependencies and add per-stage fallback_decision before retrying.';
  }
  if (input.mcps !== undefined && input.dependencies === undefined) {
    return 'manifest input has top-level "mcps" but no "dependencies" — the contract is now '
      + 'version "2"; rename mcps -> dependencies and add a kind field to each entry.';
  }
  return null;
}

function validateDependencyNames(dependencies) {
  const contract = loadContract();
  for (const name of Object.keys(dependencies)) {
    if (!contract.dependencies[name]) {
      const valid = Object.keys(contract.dependencies).join(', ');
      return `unknown dependency '${name}'; valid: [${valid}]`;
    }
  }
  return null;
}

export async function emitManifestCommand(opts) {
  const projectDir = process.cwd();
  const brandDir = join(projectDir, '.brand');

  if (!existsSync(brandDir)) {
    console.error(chalk.red(`No .brand/ directory at ${projectDir}.`));
    process.exit(1);
  }

  const stdinRaw = await readStdin();
  let input = {};
  if (stdinRaw.trim()) {
    try {
      input = JSON.parse(stdinRaw);
    } catch (err) {
      console.error(chalk.red(`Failed to parse stdin as JSON: ${err.message}`));
      process.exit(1);
    }
  }

  const v1Reason = rejectV1(input);
  if (v1Reason) {
    console.error(chalk.red(v1Reason));
    process.exit(1);
  }

  const brandrc = loadBrandrc(projectDir);
  const tier = input.tier ?? brandrc.tier ?? 'minimum';
  // The manifest schema has historically used `client` as the brand-name field.
  // Brandrc's user-facing surface is now `brand` (`client` is a deprecated alias).
  // Manifest stays v2; we translate brandrc's normalized `brand` to manifest.client
  // at write time so existing manifest consumers don't need to migrate.
  const client = input.client ?? brandrc.brand ?? '';

  if (!VALID_TIERS.includes(tier)) {
    console.error(chalk.red(
      `Invalid tier "${tier}". Expected one of: ${VALID_TIERS.join(', ')}.`
    ));
    process.exit(1);
  }

  const dependencies = input.dependencies ?? {};
  const depErr = validateDependencyNames(dependencies);
  if (depErr) {
    console.error(chalk.red(depErr));
    process.exit(1);
  }

  // Decorate dependency entries with kind from the contract (so consumers
  // don't have to cross-reference). expected_path_glob also propagated for
  // user_artifact entries.
  const decoratedDependencies = {};
  for (const [name, entry] of Object.entries(dependencies)) {
    const contractDep = getDependency(name);
    decoratedDependencies[name] = {
      kind: contractDep.kind,
      available: entry.available ?? false,
      used_by: entry.used_by ?? [],
    };
    if (contractDep.kind === 'user_artifact' && contractDep.expected_path_glob) {
      decoratedDependencies[name].expected_path_glob = contractDep.expected_path_glob;
    }
  }

  const files = buildFilesMap({
    brandDir,
    tier,
    stageOverrides: input.file_overrides,
  });

  const payload = {
    _comment: 'Generated by brand-cli. Do not hand-edit — overwritten on every /brand-context:extract run.',
    version: '2',
    generated_at: input.generated_at ?? new Date().toISOString(),
    generator: generatorString(),
    tier,
    files,
    stages: input.stages ?? {},
    dependencies: decoratedDependencies,
  };
  if (client) payload.client = client;

  const validation = validateManifest(payload);
  if (!validation.valid) {
    console.error(chalk.red(`Manifest validation failed: ${validation.errorText}`));
    process.exit(1);
  }

  if (opts.dryRun) {
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    return;
  }

  writeManifest(join(brandDir, 'manifest.json'), payload);
  if (opts.json) {
    console.log(JSON.stringify({ ok: true, path: '.brand/manifest.json' }));
  } else {
    console.log(chalk.green(`Wrote .brand/manifest.json (tier: ${tier})`));
  }
}
