import fs from 'fs-extra';
import path from 'path';

const slug = process.argv[2];
if (!slug) { console.error('Usage: npm run add:client <slug>'); process.exit(1); }

const base = path.join(process.cwd(), 'clients', slug);
await fs.ensureDir(path.join(base, 'assets'));

const siteJson = {
  slug,
  title: `${slug} – Site vitrine`,
  brand: slug.replace(/-/g, ' '),
  description: `Présentation de ${slug}`,
  lang: 'fr',
  hero: { heading: 'Titre de section', subheading: 'Sous‑titre', image: `clients/${slug}/assets/hero.webp` },
  contact: { email: `contact@${slug}.fr`, phone: "+33 6 00 00 00 00", city: "" },
  legal: {
    editor: { entity: '', representative: '', status: '', siret: '', email: '' },
    provider: { entity: 'Les Sites de David – David Bairet', siret: '', email: 'contact@lessitesdedavid.fr' },
    host: { provider: 'GitHub Pages', company: 'GitHub, Inc.', address: '88 Colin P Kelly Jr St, San Francisco, CA 94107, USA', url: 'https://pages.github.com/' }
  },
  pages: [ { path: 'index', title: 'Accueil' }, { path: 'contact', title: 'Contact' }, { path: 'mentions', title: 'Mentions légales' } ]
};

await fs.writeJson(path.join(base, 'site.json'), siteJson, { spaces: 2 });
console.log(`Client créé → clients/${slug}`);
