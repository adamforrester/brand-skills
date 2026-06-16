/**
 * Loads .brand/.scope.json and validates payloads against the scope schema.
 * Schema is compiled lazily on first validateScope() call and cached for the
 * process lifetime. loadScope() returns null when the file is absent;
 * throws with the file path on malformed JSON.
 * Spec: docs/superpowers/specs/2026-06-14-scope-json-design.md §2.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SCHEMA_PATH = resolve(__dirname, '../../../schema/brand/scope.schema.json');

let cachedAjv = null;
let cachedValidator = null;

function getValidator() {
  if (cachedValidator) return cachedValidator;
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'));
  cachedAjv = new Ajv({ allErrors: true, strict: true });
  addFormats(cachedAjv);
  cachedValidator = cachedAjv.compile(schema);
  return cachedValidator;
}

/**
 * Read .brand/.scope.json from the given brand directory.
 * Returns the parsed object if present, null if absent.
 * Throws Error with file-context message on malformed JSON.
 */
export function loadScope(brandDir) {
  const path = join(brandDir, '.scope.json');
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`.brand/.scope.json at ${path} is not valid JSON: ${err.message}`);
  }
}

/**
 * Validate a parsed scope payload against the schema.
 * Returns { valid: boolean, errorText?: string }.
 * Does not read from disk; pass an already-parsed object.
 */
export function validateScope(payload) {
  const validate = getValidator();
  const ok = validate(payload);
  if (ok) return { valid: true };
  return { valid: false, errorText: cachedAjv.errorsText(validate.errors) };
}
