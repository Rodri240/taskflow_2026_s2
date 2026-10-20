import { mkdtempSync, rmSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverDirectory = resolve(repositoryRoot, 'server');
const databaseDirectory = mkdtempSync(join(tmpdir(), 'taskflow-e2e-'));
const databaseFile = join(databaseDirectory, 'taskflow.db');
const prismaExecutable = resolve(
  serverDirectory,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
);
const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const environment = {
  ...process.env,
  DATABASE_URL: `file:${databaseFile}`,
  JWT_SECRET: 'taskflow-playwright-secret',
  PORT: '3000',
  TZ: 'America/Montevideo',
  // Prisma 6.19 puede fallar silenciosamente en macOS cuando RUST_LOG está en "warn".
  RUST_LOG: 'info',
};

// La suite nunca toca dev.db: cada ejecución comienza con una base temporal exclusiva.

const prepare = spawnSync(
  prismaExecutable,
  ['db', 'push'],
  { cwd: serverDirectory, env: environment, stdio: 'inherit' },
);

if (prepare.status !== 0) {
  rmSync(databaseDirectory, { recursive: true, force: true });
  process.exit(prepare.status ?? 1);
}

const api = spawn(npmExecutable, ['run', 'dev'], {
  cwd: serverDirectory,
  env: environment,
  stdio: 'inherit',
});

function stop(signal) {
  if (!api.killed) api.kill(signal);
}

process.once('exit', () => {
  rmSync(databaseDirectory, { recursive: true, force: true });
});
process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));
api.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
