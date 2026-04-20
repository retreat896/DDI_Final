/**
 * build-frontend.mjs
 * ------------------
 * Builds the React frontend from ../../frontend into ./dist/
 * so that `wrangler dev` / `wrangler deploy` can serve it as static assets.
 *
 * Sets VITE_API_BASE="" so all API calls use relative URLs (/api/...)
 * which work on the same origin as the wrangler server.
 *
 * Usage:
 *   node build-frontend.mjs           # production build
 *   node build-frontend.mjs --watch   # rebuild on file changes (dev mode)
 */

import { execSync, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');
const OUT_DIR      = path.resolve(__dirname, 'dist');
const WATCH        = process.argv.includes('--watch');

if (!fs.existsSync(FRONTEND_DIR)) {
  console.error(`❌ Frontend directory not found: ${FRONTEND_DIR}`);
  process.exit(1);
}

// Ensure dist/ exists so wrangler doesn't error before the first build
fs.mkdirSync(OUT_DIR, { recursive: true });

const env = {
  ...process.env,
  VITE_API_BASE: '',         // relative URLs — works on any origin
  NODE_ENV: 'production',
};

const args = [
  'vite', 'build',
  '--outDir', OUT_DIR,
  '--emptyOutDir',
  ...(WATCH ? ['--watch'] : []),
];

console.log(`🏗️  Building frontend → ${OUT_DIR}`);
if (WATCH) console.log('   (watch mode — rebuilds on file changes)\n');

if (WATCH) {
  // In watch mode, spawn so the process stays alive
  const child = spawn('npx', args, {
    cwd: FRONTEND_DIR,
    env,
    stdio: 'inherit',
    shell: true,
  });
  child.on('close', (code) => process.exit(code ?? 0));
} else {
  execSync(`npx ${args.join(' ')}`, { cwd: FRONTEND_DIR, env, stdio: 'inherit' });
  console.log('\n✅ Frontend built successfully.');
}
