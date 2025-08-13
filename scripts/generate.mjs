// scripts/generate.mjs
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import ejs from "ejs";
import glob from "glob";
import { minifyHtml } from "./utils.mjs"; // garde si tu l'as déjà

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, "..");

// Résolution souple des dossiers (au cas où tu aies "modèle"/"publique")
function resolveDir(...names) {
  for (const n of names) {
    const p = path.join(root, n);
    if (fs.existsSync(p)) return p;
  }
  return path.join(root, names[0]);
}

const TEMPLATE   = resolveDir("template", "modèle");
const CLIENTS    = resolveDir("clients", "client");
const DIST       = resolveDir("dist");
const PUBLIC_DIR = resolveDir("public", "publique");

// --- Base path pour GitHub Pages (projet) ---
// Priorité à PUBLIC_URL si défini (ex: "https://davidbairet.github.io/les-sites-de-david/")
const repoName   = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const CI_BASE    = repoName ? `/${repoName}/` : "/";
const basePath   = process.env.PUBLIC_URL?.endsWith("/")
  ? process.env.PUBLIC_URL
  : (process.env.PUBLIC_URL ? process.env.PUBLIC_URL + "/" : (process.env.GITHUB_ACTIONS ? CI_BASE : "/"));

// Utilitaires
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeHtml = async (outPath, html) => {
  const finalHtml = typeof minifyHtml === "function" ? minifyHtml(html) : html;
  await fs.outputFile(outPath, finalHtml, "utf8");
};

async function main() {
  // Clean + ensure dist
  await fs.remove(DIST);
  await fs.ensureDir(DIST);

  // Copie des assets publics s'ils existent
  if (await fs.pathExists(PUBLIC_DIR)) {
    await fs.copy(PUBLIC_DIR, DIST);
  }

  // Lister les clients
  const clientDirs = (await fs.readdir(CLIENTS))
    .map((d) => path.join(CLIENTS, d))
    .filter((p) => fs.lstatSync(p).isDirectory());

  const builtClients = [];

  for (const cdir of clientDirs) {
    const siteJsonPath = path.join(cdir, "site.json");
    if (!(await fs.pathExists(siteJsonPath))) continue;

    const site = readJson(siteJsonPath);
    if (site.build === false) continue;

    const slug = site.slug || path.basename(cdir);
    const outDir = path.join(DIST, "clients", slug);

    // Copie d'éventuels assets du template
    const templateAssets = path.join(TEMPLATE, "assets");
    if (await fs.pathExists(templateAssets)) {
      await fs.copy(templateAssets, path.join(outDir, "assets"));
    }

    // Rendu des pages
    const pages = site.pages?.length ? site.pages : [{ path: "index", title: "Accueil" }];

    for (const page of pages) {
      const pageName = page.path.replace(/\.html?$/i, "");
      // On cherche un template spécifique, sinon fallback sur "page.ejs", sinon "index.ejs"
      const candidates = [
        path.join(TEMPLATE, `${pageName}.ejs`),
        path.join(TEMPLATE, "page.ejs"),
        path.join(TEMPLATE, "index.ejs"),
      ];
      const templatePath = candidates.find((p) => fs.existsSync(p));
      if (!templatePath) {
        // Template absent : génère une page ultra simple pour ne pas casser le build
        const html = `<!doctype html><meta charset="utf-8"><title>${site.title ?? "Site"}</title>
<main style="font-family:system-ui;padding:2rem;color:#eee;background:#111">
  <h1>${site.title ?? "Site"}</h1>
  <p>Page <strong>${pageName}</strong> (template par défaut)</p>
</main>`;
        await writeHtml(path.join(outDir, `${pageName}.html`), html);
        continue;
      }

      // Données envoyées au template
      const data = {
        site,
        page,
        basePath,        // <- IMPORTANT pour Pages
        slug,
        clientOutDir: `clients/${slug}/`,
        isCI: !!process.env.GITHUB_ACTIONS,
      };

      // Rendu EJS avec filename pour includes relatifs ✅
      const tpl = await fs.readFile(templatePath, "utf8");
      const html = ejs.render(tpl, data, { filename: templatePath });

      await writeHtml(path.join(outDir, `${pageName}.html`), html);
    }

    builtClients.push(slug);
  }

  // --- Index racine & 404 ---
  // Si on a construit au moins un client, on redirige la racine vers le premier
  if (builtClients.length > 0) {
    const first = builtClients[0];
    const indexHtml = `<!doctype html>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=clients/${first}/">
<title>Redirection…</title>
<a href="clients/${first}/">Aller au site</a>`;
    await writeHtml(path.join(DIST, "index.html"), indexHtml);
  } else {
    const indexHtml = `<!doctype html>
<meta charset="utf-8"><title>Aucun client</title>
<main style="font-family:system-ui;padding:2rem">
  <h1>Aucun client construit</h1>
  <p>Ajoute un dossier dans <code>clients/</code> avec un <code>site.json</code> et <code>"build": true</code>.</p>
</main>`;
    await writeHtml(path.join(DIST, "index.html"), indexHtml);
  }

  const notFound = `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page introuvable</title>
<main style="font-family:system-ui;padding:2rem">
  <h1>Oups, page introuvable</h1>
  <p><a href="./">← Retour à l’accueil</a></p>
</main>`;
  await writeHtml(path.join(DIST, "404.html"), notFound);

  console.log("Build OK ✅", { builtClients, basePath });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
