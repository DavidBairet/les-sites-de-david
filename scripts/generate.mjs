import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import ejs from 'ejs';
import glob from 'glob';
import { minifyHtml } from './utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

// Résolution souple des dossiers (au cas où tu aurais "modèle"/"publique")
function resolveDir(...names) {
  for (const n of names) {
    const p = path.join(root, n);
    if (fs.existsSync(p)) return p;
  }
  return path.join(root, names[0]);
}

const TEMPLATE = resolveDir('template', 'modèle');
const CLIENTS  = resolveDir('clients', 'client');
const DIST     = resolveDir('dist');
const PUBLIC_DIR = resolveDir('public', 'publique');

// Détecte si on est en CI GitHub (Pages de projet) et calcule le préfixe d'URL
const ghParts = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/') : null; // ['DavidBairet','les-sites-de-david']
const repoSlug = ghParts ? ghParts[1] : '';
const pathPrefix = repoSlug ? `/${repoSlug}` : ''; // en local: '' ; en CI: '/les-sites-de-david'

function renderPage(templatePath, data, outFile) {
  const tpl = fs.readFileSync(templatePath, 'utf8');
  const html = ejs.render(tpl, data, { root: TEMPLATE });
  fs.outputFileSync(outFile, minifyHtml(html));
}

function copySharedAssets(dest) {
  // Copie les assets partagés dans le répertoire du client
  const tplStyles = path.join(TEMPLATE, 'styles');
  const tplAssets = path.join(TEMPLATE, 'assets');
  if (fs.existsSync(tplStyles)) fs.copySync(tplStyles, path.join(dest, 'template/styles'));
  if (fs.existsSync(tplAssets)) fs.copySync(tplAssets, path.join(dest, 'template/assets'));
}

async function buildClient(dir) {
  const site = fs.readJsonSync(path.join(dir, 'site.json'));
  const slug = site.slug;                          // ✅ slug défini
  const out  = path.join(DIST, slug);
  const basePath = `${pathPrefix}/${slug}`;        // ✅ bon basePath en CI et en local

  // assets client → dist/clients/<slug>/assets
  const clientAssets = path.join(dir, 'assets');
  if (fs.existsSync(clientAssets)) {
    await fs.copy(clientAssets, path.join(out, 'clients', slug, 'assets'));
  }

  copySharedAssets(out);

  // Rendre toutes les pages ejs
  const pages = glob.sync('template/pages/*.ejs', { cwd: root, absolute: true });
  for (const page of pages) {
    const name = path.basename(page, '.ejs');
    const destFile = path.join(out, name === 'index' ? 'index.html' : name, name === 'index' ? '' : 'index.html');
    renderPage(page, { site, basePath, page: { title: name } }, destFile);
  }
}

async function generateSitemap() {
  const gh = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/') : null;
  const owner = gh ? gh[0] : 'DavidBairet';
  const repo  = gh ? gh[1] : '';
  const siteBase = `https://${owner}.github.io${repo ? `/${repo}` : ''}`;

  const clients = (await fs.readdir(CLIENTS)).filter(d => fs.statSync(path.join(CLIENTS, d)).isDirectory());
  let urls = [];
  for (const slug of clients) {
    const pages = ['/', '/contact/', '/mentions/'];
    urls.push(...pages.map(p => `/${slug}${p}`));
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u=>`  <url><loc>${siteBase}${u}</loc></url>`).join('\n')}
</urlset>`;
  await fs.outputFile(path.join(DIST, 'sitemap.xml'), xml);
}

async function copyPublic() {
  if (PUBLIC_DIR && fs.existsSync(PUBLIC_DIR)) {
    await fs.copy(PUBLIC_DIR, DIST);
  }
}

async function main() {
  await fs.emptyDir(DIST);

  const dirs = (await fs.readdir(CLIENTS))
    .map(d => path.join(CLIENTS, d))
    .filter(p => fs.statSync(p).isDirectory());

  for (const d of dirs) await buildClient(d);

  // Hub index (CSS inline minimal pour éviter des chemins compliqués)
  const list = dirs.map(p => path.basename(p));
  const hub = `<!doctype html><html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sites clients</title>
<style>
  body{font-family:system-ui,Segoe UI,Roboto;margin:0;background:#0f0f12;color:#eaeaea}
  .container{max-width:960px;margin:auto;padding:24px}
  a{color:#eaeaea;text-decoration:none}
  li{margin:8px 0}
</style>
</head><body>
<div class="container">
  <h1>Sites clients</h1>
  <ul>
    ${list.map(slug=>`<li><a href="${pathPrefix}/${slug}/">${slug}</a></li>`).join('')}
  </ul>
</div>
</body></html>`;
  await fs.outputFile(path.join(DIST, 'index.html'), minifyHtml(hub));

  await copyPublic();
  await generateSitemap();
  console.log('Build OK → dist/');
}

main().catch(e => { console.error(e); process.exit(1); });
