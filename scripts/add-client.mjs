// scripts/add-client.mjs
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const root       = path.join(__dirname, "..");

// ---------- utils ----------
function asSlug(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
function parseArgs(argv) {
  // ex: node scripts/add-client.mjs ink & co --title "Ink & Co"
  const args = [];
  const opts = {};
  let i = 2;
  while (i < argv.length) {
    const tok = argv[i];
    if (tok.startsWith("--")) {
      const key = tok.replace(/^--/, "");
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      opts[key] = val;
    } else {
      args.push(tok);
    }
    i++;
  }
  return { args, opts };
}

// ---------- main ----------
(async () => {
  const { args, opts } = parseArgs(process.argv);
  if (!args.length) {
    console.error("Usage: npm run add:client <nom-ou-slug> [--title \"Nom Complet\"]");
    process.exit(1);
  }

  const raw  = args.join(" ");       // autorise espaces
  const slug = asSlug(raw);
  const title = opts.title || raw.replace(/\s+/g, " ").trim();

  const clientsDir = path.join(root, "clients");
  const dst = path.join(clientsDir, slug);

  if (await fs.pathExists(dst)) {
    console.error(`❌ Le dossier clients/${slug} existe déjà. Abandon.`);
    process.exit(1);
  }

  // 1) copier depuis un starter si présent
  const starter = path.join(clientsDir, "_starter");
  if (await fs.pathExists(starter)) {
    await fs.copy(starter, dst);
  } else {
    // 2) sinon, créer une structure minimale
    await fs.ensureDir(path.join(dst, "assets", "img"));
    await fs.ensureDir(path.join(dst, "pages"));
    await fs.ensureDir(path.join(dst, "partials"));

    // pages minimales si pas de starter
    await fs.outputFile(
      path.join(dst, "pages", "index.ejs"),
      `<!doctype html><html lang="fr"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title><%= site.title %></title>
  <link rel="stylesheet" href="<%= basePath %>/assets/styles.css">
</head><body>
  <h1><%= site.title %></h1>
  <p><%= site.description || '' %></p>
  <script src="<%= basePath %>/assets/script.js"></script>
</body></html>`
    );
    await fs.outputFile(path.join(dst, "assets", "styles.css"), `:root{--brand:#e11d48}body{margin:0;font-family:system-ui;background:#0c0c0d;color:#f3f3f3;padding:24px}`);
    await fs.outputFile(path.join(dst, "assets", "script.js"), `document.addEventListener('DOMContentLoaded',()=>{const y=document.getElementById('year');if(y) y.textContent=new Date().getFullYear();});`);
  }

  // 3) fusionner/écrire site.json
  const sitePath = path.join(dst, "site.json");
  let site = {};
  if (await fs.pathExists(sitePath)) {
    try { site = await fs.readJson(sitePath); } catch {}
  }

  const merged = {
    // flags de contrôle
    build: true,
    listed: true,

    // identité
    slug,
    title: site.title || title || `${slug} – Site vitrine`,
    brand: site.brand || title || slug.replace(/-/g, " "),
    description: site.description || `Présentation de ${title || slug}`,

    lang: site.lang || "fr",

    // thème (variables CSS injectables si tu le gères dans head.ejs)
    theme: {
      brand: site.theme?.brand || "#e11d48",
      bg:    site.theme?.bg    || "#0c0c0d",
      panel: site.theme?.panel || "#141416",
      text:  site.theme?.text  || "#f3f3f3",
      muted: site.theme?.muted || "#a1a1aa"
    },

    hero: {
      heading:  site.hero?.heading  || "Créations sur-mesure",
      subheading: site.hero?.subheading || "Galerie, tarifs et contact en un clic.",
      image: site.hero?.image || "assets/hero.webp" // IMPORTANT: chemin client-relatif
    },

    contact: {
      email: site.contact?.email || `contact@${slug}.fr`,
      phone: site.contact?.phone || "+33 6 00 00 00 00",
      city:  site.contact?.city  || ""
    },

    socials: {
      instagram: site.socials?.instagram || "",
      facebook:  site.socials?.facebook  || "",
      tiktok:    site.socials?.tiktok    || ""
    },

    legal: {
      editor: {
        entity:         site.legal?.editor?.entity         || title || slug,
        representative: site.legal?.editor?.representative || "",
        status:         site.legal?.editor?.status         || "Entrepreneur individuel (Tatouage)",
        siret:          site.legal?.editor?.siret          || "",
        email:          site.legal?.editor?.email          || `contact@${slug}.fr`
      },
      provider: {
        entity: site.legal?.provider?.entity || "Les Sites de David – David Bairet",
        siret:  site.legal?.provider?.siret  || "",
        email:  site.legal?.provider?.email  || "contact@lessitesdedavid.fr"
      },
      host: {
        provider: site.legal?.host?.provider || "GitHub Pages",
        company:  site.legal?.host?.company  || "GitHub, Inc.",
        address:  site.legal?.host?.address  || "88 Colin P Kelly Jr St, San Francisco, CA 94107, USA",
        url:      site.legal?.host?.url      || "https://pages.github.com/"
      }
    },

    seo: {
      keywords: site.seo?.keywords || ["tatouage", "fineline", "dotwork", "réalisme"],
      ogImage:  site.seo?.ogImage  || "assets/og.jpg",
      geo:      site.seo?.geo      || { lat: 0, lng: 0 }
    },

    sections: {
      styles:  site.sections?.styles  ?? true,
      artists: site.sections?.artists ?? true,
      gallery: site.sections?.gallery ?? true,
      contact: site.sections?.contact ?? true
    },

    styles: site.styles || [
      { name: "Fineline", desc: "Lignes délicates, minimalisme élégant." },
      { name: "Blackwork", desc: "Noirs profonds, contrastes puissants." },
      { name: "Réalisme", desc: "Détails précis, effets photographiques." },
      { name: "Neo-trad", desc: "Couleurs vives, motifs iconiques." }
    ],

    artists: site.artists || [
      { name: "Alex", specialties: "Fineline • Blackwork", image: "assets/img/artist-alex.jpg", profile: "artist.html" },
      { name: "Maya", specialties: "Neo-trad • Couleur",   image: "assets/img/artist-maya.jpg", profile: "artist.html" }
    ],

    gallery: site.gallery || [
      "assets/img/tattoo1.jpg",
      "assets/img/tattoo2.jpg",
      "assets/img/tattoo3.jpg"
    ],

    pages: site.pages || [
      { path: "index",    title: "Accueil" },
      { path: "contact",  title: "Contact" },
      { path: "mentions", title: "Mentions légales" }
    ]
  };

  await fs.writeJson(sitePath, merged, { spaces: 2 });

  // 4) fichiers “placeholder” utiles
  await fs.outputFile(path.join(dst, "assets", "img", ".keep"), "");
  // place des placeholders si absents
  if (!(await fs.pathExists(path.join(dst, "assets", "hero.webp")))) {
    await fs.outputFile(path.join(dst, "assets", "hero.webp"), "");
  }
  if (!(await fs.pathExists(path.join(dst, "assets", "og.jpg")))) {
    await fs.outputFile(path.join(dst, "assets", "og.jpg"), "");
  }

  console.log(`✅ Client créé → clients/${slug}`);
  console.log(`   Ouvre clients/${slug}/site.json et personnalise (contacts, artistes, couleurs...).`);
  console.log(`   Ensuite: npm run build`);
})().catch((err) => {
  console.error("❌ Erreur:", err);
  process.exit(1);
});
