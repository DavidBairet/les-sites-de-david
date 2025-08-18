// scripts/generate.mjs
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import ejs from "ejs";
import { minifyHtml } from "./utils.mjs"; // ok s'il n'existe pas, on protège plus bas

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const root       = path.join(__dirname, "..");

// Résolution souple des dossiers
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

// --- Base path pour GitHub Pages (Pages de projet) ---
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const CI_BASE  = repoName ? `/${repoName}/` : "/";
const base = process.env.PUBLIC_URL?.endsWith("/")
  ? process.env.PUBLIC_URL
  : (process.env.PUBLIC_URL ? process.env.PUBLIC_URL + "/" : (process.env.GITHUB_ACTIONS ? CI_BASE : "/"));

// Utils
const readJson = (p) => {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (err) { console.error("❌ JSON invalide dans:", p); throw err; }
};

// minifyHtml peut être sync ou async
const writeHtml = async (outPath, html) => {
  let finalHtml = html;
  if (typeof minifyHtml === "function") {
    const maybe = minifyHtml(html);
    finalHtml = (maybe && typeof maybe.then === "function") ? await maybe : maybe;
  }
  await fs.outputFile(outPath, finalHtml, "utf8");
};

async function main() {
  // Clean + ensure dist
  await fs.remove(DIST);
  await fs.ensureDir(DIST);

  // Copie des fichiers publics (robots.txt, favicon, etc.) à la racine du build
  if (await fs.pathExists(PUBLIC_DIR)) {
    await fs.copy(PUBLIC_DIR, DIST);
  }

  // Lister les dossiers clients (ignore ceux qui commencent par "_")
  const clientDirs = (await fs.readdir(CLIENTS))
    .filter((name) => !name.startsWith("_"))
    .map((name) => path.join(CLIENTS, name))
    .filter((p) => fs.lstatSync(p).isDirectory());

  const builtClients = [];

  for (const cdir of clientDirs) {
    const siteJsonPath = path.join(cdir, "site.json");
    if (!(await fs.pathExists(siteJsonPath))) continue;

    const site = readJson(siteJsonPath);
    if (site.build === false) continue;

    const slug = site.slug || path.basename(cdir);
    const outDir = path.join(DIST, "clients", slug);
    await fs.ensureDir(outDir);

    // Copier assets & styles du template
    const templateAssets = path.join(TEMPLATE, "assets");
    if (await fs.pathExists(templateAssets)) {
      await fs.copy(templateAssets, path.join(outDir, "assets"));
    }
    const templateStyles = path.join(TEMPLATE, "styles");
    const outStyles      = path.join(outDir, "styles");
    if (await fs.pathExists(templateStyles)) {
      await fs.copy(templateStyles, outStyles);
    } else {
      await fs.outputFile(
        path.join(outStyles, "main.css"),
        `*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu}
header,footer{padding:1rem}.container{max-width:960px;margin:0 auto;padding:1rem}`,
        "utf8"
      );
    }

    // Pages à rendre
    const pages = site.pages?.length ? site.pages : [{ path: "index", title: "Accueil" }];

    for (const page of pages) {
      const pageName = page.path.replace(/\.html?$/i, "");

      // Templates candidats : page spécifique -> fallback
      const candidates = [
        path.join(TEMPLATE, "pages", `${pageName}.ejs`),
        path.join(TEMPLATE, `${pageName}.ejs`),
        path.join(TEMPLATE, "page.ejs"),
        path.join(TEMPLATE, "index.ejs"),
      ];
      const templatePath = candidates.find((p) => fs.existsSync(p));

      let html;
      if (templatePath) {
        const tpl  = await fs.readFile(templatePath, "utf8");
        const data = {
          site,
          page,
          base,                         // préfixe GitHub Pages
          slug,
          clientBase: `${base}clients/${slug}/`, // pratique dans les templates
          isCI: !!process.env.GITHUB_ACTIONS,
        };

        html = ejs.render(tpl, data, {
          filename: templatePath,       // includes relatifs OK
          views: [TEMPLATE],            // include('partials/xxx') partout
        });
      } else {
        html = `<!doctype html><meta charset="utf-8">
<title>${site.title ?? "Site"}</title>
<main style="font-family:system-ui;padding:2rem;color:#eee;background:#111">
  <h1>${site.title ?? "Site"}</h1>
  <p>Page <strong>${pageName}</strong> — template manquant.</p>
</main>`;
      }

      await writeHtml(path.join(outDir, `${pageName}.html`), html);
    }

    builtClients.push(slug);
  }

  // Index racine
  if (builtClients.length > 0) {
    const first = builtClients[0];
    await writeHtml(
      path.join(DIST, "index.html"),
      `<!doctype html><meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=clients/${first}/">
<title>Redirection…</title>`
    );
  } else {
    await writeHtml(
      path.join(DIST, "index.html"),
      `<!doctype html><meta charset="utf-8">
<title>Aucun client</title>
<main style="font-family:system-ui;padding:2rem">
  <h1>Aucun client construit</h1>
  <p>Ajoute un dossier dans <code>clients/</code> avec un <code>site.json</code> et <code>"build": true</code>.</p>
</main>`
    );
  }

  // 404
  await writeHtml(
    path.join(DIST, "404.html"),
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page introuvable</title>
<main style="font-family:system-ui;padding:2rem">
  <h1>Oups, page introuvable</h1>
  <p><a href="./">← Retour à l’accueil</a></p>
</main>`
  );

  console.log("Build OK ✅", { builtClients, base });
}

main().catch((err) => { console.error(err); process.exit(1); });
