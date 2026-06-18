import chalk from 'chalk';

const warnedKeys = new Set();

/**
 * Warn-once-per-process semantics. Multiple call sites can warn for the
 * same key without spamming the console — the first call emits, subsequent
 * calls are no-ops. The Set is module-scoped so it survives across imports
 * but resets between Node processes.
 */
export function warnDeprecated(key, message) {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(chalk.yellow(`[brand-skills] ${message}`));
}

/**
 * Test-only: reset the warned set so per-test isolation works. Not exported
 * from any production CLI surface.
 */
export function _resetWarnedKeysForTesting() {
  warnedKeys.clear();
}
