/**
 * Loads and validates schema/mcp-fallback-contract.json on first import.
 * Throws on validation failure. Result is cached for the process lifetime.
 * Spec: docs/superpowers/specs/2026-06-13-mcp-fallback-contract-design.md §3.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SCHEMA_PATH   = resolve(__dirname, '../../../schema/mcp-fallback-contract.schema.json');
const CONTRACT_PATH = resolve(__dirname, '../../../schema/mcp-fallback-contract.json');

let cached = null;

/**
 * Load + validate the contract. Subsequent calls return the cached object.
 * Throws Error with ajv errorsText on validation failure.
 */
export function loadContract() {
  if (cached) return cached;
  const schema   = JSON.parse(readFileSync(SCHEMA_PATH,   'utf-8'));
  const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf-8'));
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(contract)) {
    throw new Error(`mcp-fallback-contract.json failed schema validation: ${ajv.errorsText(validate.errors)}`);
  }
  cached = contract;
  return cached;
}

/** Return the stage entry for a stage key (e.g. '3_voice'), or undefined. */
export function getStageContract(stageKey) {
  return loadContract().stages[stageKey];
}

/** Return the dependency entry for a dependency name (e.g. 'jina-reader'), or undefined. */
export function getDependency(name) {
  return loadContract().dependencies[name];
}
