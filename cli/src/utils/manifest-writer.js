import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SCHEMA_PATH = resolve(__dirname, '../../../schema/manifest.schema.json');
const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'));

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

/**
 * Validate a manifest payload against schema/manifest.schema.json.
 * Returns { valid, errors, errorText }.
 */
export function validateManifest(payload) {
  const valid = validate(payload);
  if (valid) return { valid: true, errors: null, errorText: null };
  return {
    valid: false,
    errors: validate.errors,
    errorText: ajv.errorsText(validate.errors),
  };
}

/**
 * Validate then write a manifest payload as pretty-printed JSON with trailing newline.
 * Throws on validation failure — fail-loud is intentional.
 */
export function writeManifest(absPath, payload) {
  const result = validateManifest(payload);
  if (!result.valid) {
    throw new Error(`manifest.json failed schema validation: ${result.errorText}`);
  }
  writeFileSync(absPath, JSON.stringify(payload, null, 2) + '\n');
}
