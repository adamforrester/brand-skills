import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLI_BIN = resolve(__dirname, '../../bin/brand-cli.js');

/**
 * Spawn `node brand-cli.js <args>` with optional cwd and stdin.
 * Returns { exitCode, stdout, stderr } when the process closes.
 */
export function runCli(args, { cwd, stdin } = {}) {
  return new Promise((resolveP, rejectP) => {
    const proc = spawn('node', [CLI_BIN, ...args], {
      cwd: cwd ?? process.cwd(),
      env: { ...process.env, NO_COLOR: '1' },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', rejectP);
    proc.on('close', (exitCode) => resolveP({ exitCode, stdout, stderr }));
    if (stdin !== undefined) {
      proc.stdin.end(stdin);
    } else {
      proc.stdin.end();
    }
  });
}
