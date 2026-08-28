#!/usr/bin/env node
/**
 * Prepare a clean Netlify deploy folder (netlify-deploy/).
 * Includes only runtime files — no markdown docs or JSON backups.
 */
import { cpSync, mkdirSync, rmSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'netlify-deploy');

const includes = [
  'index.html',
  'friel-coach-context.md',
  'netlify.toml',
  join('netlify', 'functions'),
];

function copyPath(relPath) {
  const src = join(root, relPath);
  const dest = join(outDir, relPath);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const rel of includes) {
  const src = join(root, rel);
  if (!statSync(src, { throwIfNoEntry: false })) {
    console.error(`Missing required file: ${rel}`);
    process.exit(1);
  }
  copyPath(rel);
}

console.log(`Netlify deploy folder ready: ${outDir}`);
console.log('Upload this folder to Netlify (drag & drop or CLI).');
