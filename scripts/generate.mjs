import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import ejs from 'ejs';
import glob from 'glob';
import { minifyHtml } from './utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const TEMPLATE = path.join(root, 'template');
const CLIENTS = path.join(root, 'clients');
const DIST = path.join(root, 'dist');

function renderPage(templatePath, data, outFile) {
  const tpl = fs.readFileSync(templatePath, 'utf8');
  const html = ejs.render(tpl, data, { root: TEMPLATE });
  fs.outputFileSync(outFile, minifyHtml(html));
}

function copySharedAssets(dest) {
  fs.copySync(path.join(TEMPLATE, 'styles'), path.join(dest, 'template/styles'));
  fs.copySync(path.join(TEMPLATE, 'assets'), path.join(dest, 'template/assets'));
}

async function buildClient(dir) {
  const site = fs.readJsonSync(path.join(dir, 'site.json'));
  const slug = site.slug;
  const out = path.join(DIST, slug);
  const basePath = `/${slug}`;

  const clientAssets = path.join(dir, 'assets');
  if (fs.existsSync(clientAssets)) {
    await fs.copy(clientAssets, path.join(out, 'clients', slug, 'assets'));
  }
  copySharedAssets(out);

  const pages = glob.sync('template/pages/*.ejs', { cwd: root, absolute: true });
  for (const page of pages) {
    const name = path.basename(page, '.ejs');
    const destFile = path.join(out, name === 'index' ? 'index.html' : name, name === 'index' ? '' : 'index.html');
    renderPage(page, { site, basePath, page: { title: name } }, destFile);
  }
}

async function generateSitemap() {
  const clients = (await fs.readdir(CLIENTS)).filter(d => fs.statSync(path.join(CLIENTS, d)).isDirectory());
  let urls = [];
  for (const slug of clients) {
    const pages = ['/', '/contact/', '/mentions/'];
    urls.push(...pages.map(p => `/${slug}${p}`));
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u=>`  <url><loc>https://USER.github.io${u}</loc></url>`).join('\n')}
</urlset>`;
  await fs.outputFile(path.join(DIST, 'sitemap.xml'), xml);
}

async function copyPublic() {
  const src = path.join(root, 'public');
  if (fs.existsSync(src)) await fs.copy(src, DIST);
}

async function main() {
  await fs.emptyDir(DIST);
  const dirs = (await fs.readdir(CLIENTS)).map(d => path.join(CLIENTS, d)).filter(p => fs.statSync(p).isDirectory());
  for (const d of dirs) await buildClient(d);

  // Hub index
  const list = dirs.map(p => path.basename(p));
  const hub = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sites clients</title><link rel="stylesheet" href="template/styles/main.css"></head><body class="container"><h1>Sites clients</h1><ul>${list.map(slug=>`<li><a href="/${slug}/">${slug}</a></li>`).join('')}</ul></body></html>`;
  await fs.outputFile(path.join(DIST, 'index.html'), minifyHtml(hub));

  await copyPublic();
  await generateSitemap();
  console.log('Build OK → dist/');
}

main().catch(e => { console.error(e); process.exit(1); });
