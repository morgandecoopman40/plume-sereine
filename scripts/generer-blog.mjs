// Génère le site publié dans _site/ :
//   - copie la liste blanche des fichiers du site (index.html, CNAME, assets/) ;
//   - assets/style.css = le CSS de l'accueil (index.html reste la seule source du design) ;
//   - /blog/ et /blog/<slug>/ à partir des articles publiés dans Supabase ;
//   - /<slug>/ pour les pages personnalisées publiées (anciennement #/page/<slug>) ;
//   - les pages locales écrites dans contenu/<slug>.html (texte + FAQ en en-tête JSON) ;
//   - sitemap.xml listant toutes les pages publiques.
//
// Lecture seule, avec la clé publique « anon » déjà présente dans index.html.
// Tables lues : blog_articles (publie = true), pages_custom (publie = true),
// site_config (liens des réseaux sociaux uniquement).
// Aucune dépendance : Node 18+ (fetch intégré).
//
// Usage : node scripts/generer-blog.mjs   puis   python3 -m http.server -d _site

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE = join(RACINE, '_site');
const SITE = 'https://plume-methode.fr';
const IMAGE_PARTAGE = `${SITE}/assets/og-image.png`;

// Seuls ces fichiers du dépôt sont publiés (CLAUDE.md, seo/, scripts/… ne le sont jamais).
const LISTE_BLANCHE = ['index.html', 'CNAME', 'robots.txt', 'assets'];

// Adresses déjà prises : une page perso ne peut pas les utiliser.
const SLUGS_RESERVES = new Set([
  'blog', 'assets', 'index.html', 'cname', '404.html', 'robots.txt', 'sitemap.xml',
  'cours-francais-bruay-la-buissiere', 'cours-francais-bethune',
  'preparation-bac-francais', 'preparation-brevet-francais',
]);
const SLUG_VALIDE = /^[a-z0-9][a-z0-9-]*$/;

// Pages locales et par besoin, dans l'ordre des liens croisés (sources : contenu/<slug>.html).
const PAGES_LOCALES = [
  'cours-francais-bruay-la-buissiere', 'cours-francais-bethune',
  'preparation-bac-francais', 'preparation-brevet-francais',
];
const TELEPHONE = { affiche: '06 71 08 61 61', lien: 'tel:+33671086161' };

const accueil = readFileSync(join(RACINE, 'index.html'), 'utf8');

// ─── Supabase (lecture seule) ───
const SUPABASE_URL = accueil.match(/const SUPABASE_URL = '([^']+)'/)[1];
const SUPABASE_KEY = accueil.match(/const SUPABASE_KEY = '([^']+)'/)[1];

async function lire(requete) {
  for (let essai = 1; ; essai++) {
    try {
      const rep = await fetch(`${SUPABASE_URL}/rest/v1/${requete}`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      });
      if (!rep.ok) throw new Error(`HTTP ${rep.status} ${await rep.text()}`);
      return await rep.json();
    } catch (e) {
      if (essai >= 3) throw new Error(`Supabase injoignable (${requete}) : ${e.message}`);
      await new Promise(r => setTimeout(r, 2000 * essai));
    }
  }
}

// ─── Outils ───
const echapper = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const dateFr = d => new Date(d).toLocaleDateString('fr-FR',
  { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });

const extrait = html => {
  const texte = String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return texte.length > 155 ? texte.slice(0, 152).replace(/\s+\S*$/, '') + '…' : texte;
};

// Liens internes du contenu écrit dans l'admin : « #/blog/x » → « /blog/x/ »,
// « #ancre » (ou « # » seul) → l'ancre correspondante sur l'accueil.
function corrigerLiens(html) {
  return String(html ?? '').replace(/href="#([^"]*)"/g, (_, h) => {
    if (h === '/blog' || h === '/blog/') return 'href="/blog/"';
    if (h.startsWith('/blog/')) return `href="/blog/${h.slice(6).replace(/\/$/, '')}/"`;
    if (h.startsWith('/page/')) return `href="/${h.slice(6).replace(/\/$/, '')}/"`;
    return h ? `href="/#${h}"` : 'href="/#contact"';
  });
}

function bloc(regex, nom) {
  const m = accueil.match(regex);
  if (!m) throw new Error(`Bloc introuvable dans index.html : ${nom}`);
  return m[0];
}

// ─── En-tête et pied de page repris de l'accueil ───
function entete(pagesNav) {
  let h = bloc(/<header>[\s\S]*?<\/header>/, 'header')
    .replace('href="#" class="logo"', 'href="/" class="logo"')
    .replace(/href="#([a-z][\w-]*)"/g, 'href="/#$1"')
    .replace(/<button onclick="openLoginModal\(\)" class="btn-login-nav">([^<]*)<\/button>/,
      '<a href="/#espace-prive" class="btn-login-nav" rel="nofollow">$1</a>');
  const liens = pagesNav.map(p => `<a href="/${p.slug}/">${echapper(p.titre)}</a>\n      `).join('');
  return h.replace('<a href="/#contact" class="btn-cta">', liens + '<a href="/#contact" class="btn-cta">');
}

function piedDePage(reseaux) {
  const style = "color:var(--creme);text-decoration:none;font-size:14px;display:flex;align-items:center;gap:4px;opacity:.8";
  const liens = reseaux.map(r =>
    `<a href="${echapper(r.url)}" target="_blank" rel="noopener" style="${style}">${r.icon} ${r.label}</a>`).join('');
  return bloc(/<footer>[\s\S]*?<\/footer>/, 'footer')
    .replace(/(<div id="footer-social"[^>]*>)(<\/div>)/, `$1${liens}$2`)
    .replace(/<a href="#" onclick="event\.preventDefault\(\);openCGVModal\(\)"/, '<a href="/#cgv"');
}

const SCRIPT_MENU = `<script>
function toggleMobileMenu(){var n=document.querySelector('.nav-links'),b=document.getElementById('mobile-menu-btn');
if(n.style.display==='flex'){n.style.display='none';b.textContent='☰';}else{n.style.display='flex';b.textContent='✕';}}
</script>`;

// ─── Gabarit commun des pages générées ───
function page({ chemin, titre, description, type = 'website', image, corps, jsonld = [] }, commun) {
  const url = SITE + chemin;
  const ld = jsonld.map(o => `<script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n</script>\n`).join('');
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${echapper(titre)}</title>
<meta name="description" content="${echapper(description)}">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#3D3D4E">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${echapper(titre)}">
<meta property="og:description" content="${echapper(description)}">
<meta property="og:type" content="${type}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${echapper(image || IMAGE_PARTAGE)}">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="Plume & Méthode">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css">
<style>
main.page{padding:7rem 0 3rem;min-height:70vh}
.contenu{font-size:16px;color:#3D3D4E;line-height:1.8}
.contenu h2{font-family:var(--serif);font-size:28px;font-weight:500;line-height:1.25;margin:2.5rem 0 .75rem}
.contenu h3{font-size:17px;font-weight:600;margin:1.5rem 0 .5rem}
.contenu p,.contenu ul,.contenu ol,.contenu table{margin-bottom:1rem}
.contenu ul,.contenu ol{padding-left:1.4rem}
.contenu li{margin-bottom:.35rem}
.contenu a:not(.btn-primary){color:#5E8A80}
.contenu table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden}
.contenu th,.contenu td{padding:.6rem .9rem;text-align:left;border-bottom:1px solid #EFE7DC}
.contenu th{background:var(--sauge);font-weight:600;font-size:14px}
.contenu td{white-space:nowrap}
.page-cta{background:#fff;border-radius:18px;padding:1.5rem;margin:2.5rem 0;text-align:center}
.page-cta p{margin-bottom:1rem}
.page-liens{display:flex;flex-wrap:wrap;gap:.6rem;list-style:none;padding:0!important}
.page-liens a{display:inline-block;padding:.45rem .9rem;border:1px solid var(--dore);border-radius:99px;text-decoration:none;font-size:14px}
</style>
${ld}</head>
<body>

${commun.entete}

<main class="page">
${corps}
</main>

${commun.pied}
${SCRIPT_MENU}
</body>
</html>
`;
}

const LIEN_RETOUR = 'color:#7BA098;text-decoration:none;font-size:14px;display:inline-block;margin-bottom:1.5rem';
const STYLE_H1 = 'font-family:var(--serif);font-size:36px;color:var(--encre);line-height:1.2';
const STYLE_TEXTE = 'font-size:16px;color:#3D3D4E;line-height:1.8';

function pageListeBlog(articles, commun) {
  const cartes = articles.map(a => `<a href="/blog/${a.slug}/" style="text-decoration:none;display:block;margin-bottom:1.5rem">
        <div class="admin-card" style="overflow:hidden">
          ${a.image_url ? `<div style="height:200px;background:url('${echapper(a.image_url)}') center/cover no-repeat;border-radius:12px 12px 0 0;margin:-1.25rem -1.25rem 1rem -1.25rem;width:calc(100% + 2.5rem)"></div>` : ''}
          <h2 class="admin-card-title" style="font-size:20px">${echapper(a.titre)}</h2>
          ${a.description ? `<p style="color:#5C5C6E;font-size:14px;margin-top:.5rem">${echapper(a.description)}</p>` : ''}
          <div class="admin-card-meta" style="margin-top:.5rem"><span>📅 <time datetime="${echapper(a.date_publication)}">${dateFr(a.date_publication)}</time></span></div>
        </div></a>`).join('\n      ');
  return page({
    chemin: '/blog/',
    titre: 'Blog : conseils et méthodes en français | Plume & Méthode',
    description: 'Conseils de méthode, de grammaire et d\'orthographe pour progresser en français, du primaire au lycée, par Plume & Méthode à Bruay-la-Buissière et Béthune.',
    corps: `<div class="container" style="max-width:800px">
      <a href="/" style="${LIEN_RETOUR}">← Retour à l'accueil</a>
      <h1 style="${STYLE_H1};margin-bottom:2rem">Blog Plume & Méthode</h1>
      ${articles.length ? cartes : '<p style="color:#7BA098">Aucun article publié pour le moment.</p>'}
    </div>`,
  }, commun);
}

function pageArticle(a, commun) {
  return page({
    chemin: `/blog/${a.slug}/`,
    titre: `${a.titre} | Plume & Méthode`,
    description: a.description || extrait(a.contenu),
    type: 'article',
    image: a.image_url,
    corps: `<div class="container" style="max-width:700px">
      <a href="/blog/" style="${LIEN_RETOUR}">← Retour au blog</a>
      <article>
        <h1 style="${STYLE_H1};margin-bottom:.5rem">${echapper(a.titre)}</h1>
        <div style="color:#7BA098;font-size:14px;margin-bottom:2rem">📅 <time datetime="${echapper(a.date_publication)}">${dateFr(a.date_publication)}</time></div>
        ${a.image_url ? `<img src="${echapper(a.image_url)}" alt="${echapper(a.titre)}" style="width:100%;border-radius:16px;margin-bottom:2rem;max-height:400px;object-fit:cover">` : ''}
        <div style="${STYLE_TEXTE}">${corrigerLiens(a.contenu)}</div>
      </article>
    </div>`,
  }, commun);
}

function pagePerso(p, commun) {
  return page({
    chemin: `/${p.slug}/`,
    titre: `${p.titre} | Plume & Méthode`,
    description: p.description || extrait(p.contenu),
    corps: `<div class="container" style="max-width:700px">
      <a href="/" style="${LIEN_RETOUR}">← Retour à l'accueil</a>
      <h1 style="${STYLE_H1};margin-bottom:2rem">${echapper(p.titre)}</h1>
      <div style="${STYLE_TEXTE}">${corrigerLiens(p.contenu)}</div>
    </div>`,
  }, commun);
}

// Date de dernière modification d'un fichier du dépôt (via Git), sinon rien.
function dateGit(fichier) {
  try { return execSync(`git log -1 --format=%cI -- ${fichier}`, { cwd: RACINE }).toString().trim() || null; }
  catch { return null; }
}

function sitemap(entrees) {
  const urls = entrees.map(e => `  <url>\n    <loc>${SITE}${e.chemin}</loc>\n` +
    (e.lastmod ? `    <lastmod>${new Date(e.lastmod).toISOString().slice(0, 10)}</lastmod>\n` : '') + '  </url>').join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// ─── Pages locales (contenu/<slug>.html : en-tête JSON en commentaire, puis le texte) ───
function lirePageLocale(slug) {
  const source = readFileSync(join(RACINE, 'contenu', `${slug}.html`), 'utf8');
  const m = source.match(/^<!--([\s\S]*?)-->\s*/);
  if (!m) throw new Error(`contenu/${slug}.html : en-tête JSON manquant`);
  return { slug, ...JSON.parse(m[1]), corps: source.slice(m[0].length).trim() };
}

function pageLocale(p, toutes, article, commun) {
  const autres = toutes.filter(o => o.slug !== p.slug);
  const liens = [
    ...autres.map(o => `<li><a href="/${o.slug}/">${echapper(o.lien)}</a></li>`),
    ...(article ? [`<li><a href="/blog/${article.slug}/">Article : ${echapper(article.titre)}</a></li>`] : []),
  ].join('\n        ');
  const faq = p.faq.map(f => `<h3>${echapper(f.q)}</h3>\n      <p>${echapper(f.r)}</p>`).join('\n      ');
  return page({
    chemin: `/${p.slug}/`,
    titre: p.titre,
    description: p.description,
    corps: `<div class="container" style="max-width:760px">
      <a href="/" style="${LIEN_RETOUR}">← Retour à l'accueil</a>
      <h1 style="${STYLE_H1};margin-bottom:1.5rem">${echapper(p.h1)}</h1>
      <div class="contenu">
      ${p.corps}

      <h2>Questions fréquentes</h2>
      ${faq}

      <div class="page-cta">
        <p><strong>Prêt à faire le premier pas ?</strong> Le premier échange est gratuit.</p>
        <a href="/#contact" class="btn-primary">Réserver un premier cours</a>
        <p style="margin:1rem 0 0">ou appelez le <a href="${TELEPHONE.lien}">${TELEPHONE.affiche}</a></p>
      </div>

      <h2>À voir aussi</h2>
      <ul class="page-liens">
        ${liens}
      </ul>
      </div>
    </div>`,
    jsonld: [{
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: p.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.r } })),
    }],
  }, commun);
}

function ecrire(chemin, contenu) {
  const fichier = join(SORTIE, chemin);
  mkdirSync(dirname(fichier), { recursive: true });
  writeFileSync(fichier, contenu);
}

function garderSlugsValides(lignes, type) {
  return lignes.filter(l => {
    const ok = SLUG_VALIDE.test(l.slug || '') && !(type === 'page' && SLUGS_RESERVES.has(l.slug));
    if (!ok) console.warn(`⚠️  ${type} ignoré(e) : adresse « ${l.slug} » invalide ou réservée (${l.titre})`);
    return ok;
  });
}

// ─── Génération ───
const [articlesBruts, pagesBrutes, config] = await Promise.all([
  lire('blog_articles?select=titre,slug,description,contenu,image_url,date_publication,updated_at&publie=eq.true&order=date_publication.desc'),
  lire('pages_custom?select=titre,slug,description,contenu,show_in_nav,ordre&publie=eq.true&order=ordre'),
  lire('site_config?select=cle,valeur&cle=in.(instagram,facebook,tiktok,linkedin)'),
]);
const articles = garderSlugsValides(articlesBruts, 'article');
const pages = garderSlugsValides(pagesBrutes, 'page');

const valeurs = Object.fromEntries(config.map(c => [c.cle, c.valeur]));
const reseaux = [
  { cle: 'instagram', icon: '📸', label: 'Instagram' },
  { cle: 'facebook', icon: '📘', label: 'Facebook' },
  { cle: 'tiktok', icon: '🎵', label: 'TikTok' },
  { cle: 'linkedin', icon: '💼', label: 'LinkedIn' },
].filter(r => /^https?:\/\//.test(valeurs[r.cle] || '')).map(r => ({ ...r, url: valeurs[r.cle] }));

const commun = { entete: entete(pages.filter(p => p.show_in_nav)), pied: piedDePage(reseaux) };

rmSync(SORTIE, { recursive: true, force: true });
mkdirSync(SORTIE);
for (const f of LISTE_BLANCHE) {
  if (existsSync(join(RACINE, f))) cpSync(join(RACINE, f), join(SORTIE, f), { recursive: true });
}
ecrire('assets/style.css', bloc(/<style>[\s\S]*?<\/style>/, 'style').slice(7, -8).trim() + '\n');
ecrire('blog/index.html', pageListeBlog(articles, commun));
for (const a of articles) ecrire(`blog/${a.slug}/index.html`, pageArticle(a, commun));
for (const p of pages) ecrire(`${p.slug}/index.html`, pagePerso(p, commun));
const locales = PAGES_LOCALES.map(lirePageLocale);
for (const p of locales) ecrire(`${p.slug}/index.html`, pageLocale(p, locales, articles[0], commun));

// Plan du site : uniquement des pages publiques (l'espace privé n'a pas d'URL propre).
ecrire('sitemap.xml', sitemap([
  { chemin: '/', lastmod: dateGit('index.html') },
  ...locales.map(p => ({ chemin: `/${p.slug}/`, lastmod: dateGit(`contenu/${p.slug}.html`) })),
  { chemin: '/blog/', lastmod: articles[0]?.updated_at || articles[0]?.date_publication },
  ...articles.map(a => ({ chemin: `/blog/${a.slug}/`, lastmod: a.updated_at || a.date_publication })),
  ...pages.map(p => ({ chemin: `/${p.slug}/` })),
]));

console.log(`✅ _site généré : ${locales.length} page(s) locale(s), ${articles.length} article(s), ${pages.length} page(s) perso.`);
