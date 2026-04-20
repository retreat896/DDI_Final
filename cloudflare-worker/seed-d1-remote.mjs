/**
 * seed-d1-remote.mjs
 * ------------------
 * Seeds the REMOTE Cloudflare D1 database by:
 *   1. Generating a SQL file from each CSV (single-row INSERTs, no SQLITE_TOOBIG risk)
 *   2. Running ONE `wrangler d1 execute --remote --file=<sql>` call per table
 *
 * This is the fastest and most reliable method — wrangler streams the file
 * directly to Cloudflare without round-tripping per batch.
 *
 * Usage:
 *   npm run seed:remote
 *
 * Estimated time:
 *   ~2–5 minutes total (file generation + one upload per table)
 *
 * Prerequisites:
 *   • wrangler.jsonc has the correct database_id
 *   • You are authenticated: npx wrangler login  (or CLOUDFLARE_API_TOKEN is set)
 *   • The D1 database exists: npx wrangler d1 create steam-db
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASETS  = path.resolve(__dirname, '../../datasets');
const DB_NAME   = 'steam-db';
const TMP_DIR   = os.tmpdir();

/** Columns skipped for game_analytics (large HTML, never queried). */
const SKIP_COLS = new Set(['pc_req_min', 'pc_req_rec']);

const TARGETS = [
  { csv: 'game_analytics.csv', table: 'game_analytics' },
  { csv: 'steam-games.csv',    table: 'steam_games'    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Mirrors Python import_datasets.py clean_name(). */
function cleanName(raw) {
  let s = raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (!s || /^\d/.test(s)) s = '_' + s;
  return s;
}

/** Escape a value as a SQLite string literal. Empty string → NULL. */
function sqlLiteral(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

/**
 * Run a wrangler d1 command against the REMOTE database.
 * Returns stdout text.
 */
function wranglerRemote(args) {
  return execSync(
    `npx wrangler d1 ${args}`,
    { cwd: __dirname, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
}

/** Check if a table already has rows on the remote DB. Returns count. */
function remoteRowCount(table) {
  try {
    const out    = wranglerRemote(`execute ${DB_NAME} --remote --command "SELECT COUNT(*) AS c FROM \\"${table}\\";"` );
    const parsed = JSON.parse(out.match(/\[.*\]/s)?.[0] ?? '[]');
    return Number(parsed?.[0]?.results?.[0]?.c ?? 0);
  } catch {
    return 0; // table doesn't exist yet
  }
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

/** Streaming CSV parser — yields one string[] per row. */
async function* parseCSV(filePath) {
  const CHUNK = 64 * 1024;
  const fd    = fs.openSync(filePath, 'r');
  const buf   = Buffer.alloc(CHUNK);
  let inQuote = false, field = '', row = [], bytes;

  while ((bytes = fs.readSync(fd, buf, 0, CHUNK, null)) > 0) {
    const text = buf.subarray(0, bytes).toString('utf8');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuote) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { inQuote = false; }
        } else { field += ch; }
      } else {
        if      (ch === '"')  { inQuote = true; }
        else if (ch === ',')  { row.push(field); field = ''; }
        else if (ch === '\r') { /* skip */ }
        else if (ch === '\n') {
          row.push(field); field = '';
          if (row.length > 0) yield row;
          row = [];
        } else { field += ch; }
      }
    }
  }
  fs.closeSync(fd);
  if (field || row.length) { row.push(field); yield row; }
}

// ─── SQL file generator ───────────────────────────────────────────────────────

/**
 * Streams through a CSV and writes a .sql file with:
 *   DROP TABLE IF EXISTS / CREATE TABLE / individual single-row INSERTs.
 *
 * Returns the path to the generated SQL file.
 */
async function generateSql(csvFile, tableName) {
  const csvPath = path.join(DATASETS, csvFile);
  const sqlPath = path.join(TMP_DIR, `d1_remote_${tableName}.sql`);

  console.log(`  📝 Generating SQL file for ${tableName}…`);
  const gen = parseCSV(csvPath);

  // Read headers
  const { value: rawHeaders } = await gen.next();
  const seen = {};
  const allCols = rawHeaders.map(h => {
    const base = cleanName(h);
    if (base in seen) { seen[base]++; return `${base}_${seen[base]}`; }
    seen[base] = 0;
    return base;
  });

  // Filter columns
  const importIdx  = [];
  const importCols = [];
  allCols.forEach((col, i) => {
    if (!SKIP_COLS.has(col)) { importIdx.push(i); importCols.push(col); }
  });

  const colDefs    = importCols.map(c => `"${c}" TEXT`).join(', ');
  const colList    = importCols.map(c => `"${c}"`).join(', ');
  const insertPfx  = `INSERT INTO "${tableName}" (${colList}) VALUES`;

  // Open write stream
  const ws = fs.createWriteStream(sqlPath, { encoding: 'utf8' });

  // Header SQL
  ws.write(`DROP TABLE IF EXISTS "${tableName}";\n`);
  ws.write(`CREATE TABLE "${tableName}" (${colDefs});\n`);

  let rowCount = 0;
  for await (const row of gen) {
    const vals = importIdx.map(i => sqlLiteral(row[i] ?? ''));
    ws.write(`${insertPfx} (${vals.join(', ')});\n`);
    rowCount++;
    if (rowCount % 10000 === 0) {
      process.stdout.write(`\r    Written ${rowCount.toLocaleString()} rows…`);
    }
  }

  await new Promise((res, rej) => ws.end(err => err ? rej(err) : res()));
  const sizeMB = (fs.statSync(sqlPath).size / 1024 / 1024).toFixed(1);
  console.log(`\n    ✅ ${rowCount.toLocaleString()} rows → ${sqlPath} (${sizeMB} MB)`);
  return { sqlPath, rowCount };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const t0 = Date.now();
console.log('🚀 D1 Remote Seeder — Steam Dataset Importer');
console.log('=============================================');
console.log('  Target  : 🌐 REMOTE Cloudflare D1');
console.log('  Method  : generate SQL file → wrangler d1 execute --remote --file\n');

for (const { csv, table } of TARGETS) {
  console.log(`\n📦 ${csv} → ${table}`);

  // ── Idempotency check ──────────────────────────────────────────────────
  process.stdout.write('  🔍 Checking remote row count… ');
  const existing = remoteRowCount(table);
  if (existing > 0) {
    console.log(`already has ${existing.toLocaleString()} rows — skipping.`);
    continue;
  }
  console.log('empty, proceeding.');

  const csvPath = path.join(DATASETS, csv);
  if (!fs.existsSync(csvPath)) {
    console.log(`  ⚠️  ${csv} not found — skipping.`);
    continue;
  }

  try {
    // ── Step 1: Generate SQL file ────────────────────────────────────────
    const t1 = Date.now();
    const { sqlPath, rowCount } = await generateSql(csv, table);
    const genSec = ((Date.now() - t1) / 1000).toFixed(1);
    console.log(`  ⏱️  SQL generated in ${genSec}s`);

    // ── Step 2: Execute against remote D1 ───────────────────────────────
    console.log(`  ⬆️  Uploading to remote D1 (this may take a few minutes)…`);
    const t2 = Date.now();

    execSync(
      `npx wrangler d1 execute ${DB_NAME} --remote --file="${sqlPath}"`,
      {
        cwd: __dirname,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        stdio: 'inherit',  // show wrangler progress in terminal
      }
    );

    const uploadSec = ((Date.now() - t2) / 1000).toFixed(1);
    console.log(`  ✅ ${table}: ${rowCount.toLocaleString()} rows uploaded in ${uploadSec}s`);

    // Clean up temp SQL file
    fs.unlinkSync(sqlPath);

  } catch (e) {
    console.error(`\n  ❌ Error seeding ${table}:`, e.message);
    process.exit(1);
  }
}

// ── Indices ─────────────────────────────────────────────────────────────────
console.log('\n📌 Building remote indices…');
const indices = [
  `CREATE INDEX IF NOT EXISTS idx_ga_appid  ON game_analytics(appid);`,
  `CREATE INDEX IF NOT EXISTS idx_ga_genre  ON game_analytics(genre_primary);`,
  `CREATE INDEX IF NOT EXISTS idx_ga_tier   ON game_analytics(publisher_tier);`,
  `CREATE INDEX IF NOT EXISTS idx_ga_owners ON game_analytics(owners_midpoint);`,
  `CREATE INDEX IF NOT EXISTS idx_sg_appid  ON steam_games(app_id);`,
  `CREATE INDEX IF NOT EXISTS idx_sg_review ON steam_games(overall_review__);`,
];
for (const stmt of indices) {
  try {
    const escaped = stmt.replace(/"/g, '\\"');
    wranglerRemote(`execute ${DB_NAME} --remote --command "${escaped}"`);
    process.stdout.write('.');
  } catch { /* already exists */ }
}
console.log(' ✅');

const totalSec = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n🎉 Remote seed complete in ${totalSec}s.`);
console.log('   Run `npm run deploy` to push the worker.');
