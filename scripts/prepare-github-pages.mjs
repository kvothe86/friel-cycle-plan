#!/usr/bin/env node
/**
 * Prepare a static folder for GitHub Pages (pages-deploy/).
 * Injects <base href> for project pages when needed.
 */
import { cpSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'pages-deploy');

const includes = [
  'index.html',
  'friel-coach-context.md',
  'favicon.ico',
  'favicon.png',
  'apple-touch-icon.png',
  '.nojekyll',
];

const baseHref = process.env.GITHUB_PAGES_BASE || '/';

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const rel of includes) {
  const src = join(root, rel);
  if (!statSync(src, { throwIfNoEntry: false })) {
    console.error(`Missing required file: ${rel}`);
    process.exit(1);
  }
  if (rel === 'index.html' && baseHref !== '/') {
    let html = readFileSync(src, 'utf8');
    if (!html.includes('<base ')) {
      html = html.replace('<head>', `<head>\n  <base href="${baseHref}">`);
    }
    writeFileSync(join(outDir, rel), html);
  } else {
    cpSync(src, join(outDir, rel));
  }
}

console.log(`GitHub Pages deploy folder ready: ${outDir}`);
console.log(`Base href: ${baseHref}`);
