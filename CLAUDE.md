# CLAUDE.md — Site Plume & Méthode (plume-methode.fr)

## Contexte

Plume & Méthode : cours particuliers de français (méthode, grammaire, orthographe,
préparation brevet et bac) donnés par Justine, professeure de français indépendante,
à **Bruay-la-Buissière et Béthune** (Pas-de-Calais, bassin minier).
Site : https://plume-methode.fr

Un audit de référencement local (19 oct. 2026) a montré que la fiche Google est n°1
sur Maps à Bruay, mais que **le site est quasi invisible pour Google** :
- une seule page indexée ; le blog et les autres pages sont en URL à dièse (`#/blog`) ;
- pas de `robots.txt` ni de `sitemap.xml` (404) ;
- « Bruay » n'apparaît nulle part ; le `<title>` ne contient aucune ville ;
  le balisage Schema (JSON-LD) ne cite que Béthune.

Ta mission : corriger le site pour qu'il soit entièrement indexable et clairement
positionné sur Bruay-la-Buissière **et** Béthune.

Documents de référence (dossier `seo/`) :
- `seo/audit-plume-methode.md` — constats et plan d'action complet
- `seo/infos-reference.md` — nom, téléphone, zone, titre : la source de vérité
- `seo/taches-site.md` — la liste des chantiers et leurs critères de réussite
- `seo/modeles/` — robots.txt, Schema, plans des pages locales

## Ordre de travail

1. **Inspecter avant de toucher** : identifier la techno (HTML statique ? React/Vite ?
   Vue ? autre), le routeur utilisé, la façon dont le site est construit (`npm run build` ?)
   et l'hébergeur (fichiers `netlify.toml`, `vercel.json`, `_redirects`, `.htaccess`,
   `CNAME`, workflow GitHub Pages…). Relever le titre, la meta description, le JSON-LD
   et les tarifs actuels.
2. **Proposer un plan** adapté à la techno trouvée, en français simple, et attendre
   la validation de l'utilisateur.
3. S'assurer que le projet est sous Git et faire un commit « avant SEO ».
4. Traiter `seo/taches-site.md` dans l'ordre, un commit par tâche.
5. Construire le site et vérifier chaque critère de réussite (voir « Vérifications »).
6. Finir par un récapitulatif court : ce qui a changé, ce que l'utilisateur doit faire
   (déploiement, Search Console).

## Stack constatée (relevé du 20 oct. 2026 — à confirmer à l'étape 1)

- Dépôt GitHub `morgandecoopman40/plume-sereine`, branche `main` : **un seul fichier
  `index.html`** (~235 Ko) + `CNAME` (`plume-methode.fr`). Hébergé sur **GitHub Pages**.
  Pas de framework, pas de build : HTML + CSS + JavaScript « vanilla » dans le même fichier.
- Routage par dièse en JS : `handleRoute()` sur `hashchange`, routes `#/blog`,
  `#/blog/<slug>`, `#/page/<slug>`.
- **Backend Supabase** (`supabase-js@2` via CDN). Tables publiques utiles au SEO :
  `blog_articles` (champs `titre`, `slug`, `description`, `mots_cles`, `image_url`,
  `publie`, `created_at`…), `pages_custom`, `site_config`. Les articles sont écrits par
  Justine dans le **tableau de bord admin** du site, puis affichés côté navigateur :
  **Google ne les voit pas**.
- Le même fichier contient un **espace privé** (élèves, parents, contrats, messages,
  devoirs, bilans) : données personnelles de mineurs.
- Bugs SEO repérés : `<link rel="canonical">`, `og:url` et `url` du JSON-LD pointent vers
  `https://morgandecoopman40.github.io/plume-sereine` au lieu de `https://plume-methode.fr/`.
  Le `<h1>` de l'accueil est un slogan sans ville. Le mot « Bruay » n'apparaît pas.

## Approche technique retenue (à valider avec l'utilisateur)

GitHub Pages ne sait pas réécrire les URL : chaque page publique doit exister
**comme un vrai fichier** (`/blog/<slug>/index.html`, `/cours-francais-bethune/index.html`…).

1. **Pages fixes** (pages locales, CGV, blog) : vrais fichiers HTML qui reprennent
   l'en-tête, le pied de page et les styles de l'accueil (extraire le CSS commun dans
   `assets/style.css` si utile, sans changer le rendu).
2. **Articles du blog** : un script Node sans dépendance lourde (`scripts/generer-blog.mjs`)
   qui lit dans Supabase les articles **publiés uniquement** avec la clé publique `anon`
   déjà présente dans le site, et génère `/blog/index.html`, `/blog/<slug>/index.html`
   et `sitemap.xml`. Lancé par une **GitHub Action** (au push, chaque nuit et à la main
   via `workflow_dispatch`), qui publie le résultat sur GitHub Pages.
   → Justine continue d'écrire dans l'admin ; l'article apparaît en vraie page au plus
   tard le lendemain (ou tout de suite en relançant l'action).
3. **Anciens liens** : sur l'accueil, script qui redirige `#/blog` → `/blog/`,
   `#/blog/<slug>` → `/blog/<slug>/`, `#/page/<slug>` → la page générée équivalente.
4. Les liens du menu et du tableau de bord admin (« 🔗 #/blog/… ») pointent vers les
   nouvelles URL.

## Interdits absolus (espace privé et Supabase)

- **Ne rien casser dans l'espace privé** : connexion, tableau de bord, élèves, contrats,
  messages, devoirs, bilans, éditeur d'articles. Tester ces parcours après chaque étape.
- Ne jamais toucher aux règles RLS, au schéma, ni aux données Supabase. Lecture seule,
  et seulement sur `blog_articles` (où `publie = true`), `pages_custom` publiques et
  `site_config`.
- N'utiliser **que la clé `anon`** ; jamais de clé `service_role` dans le dépôt, le
  script ou l'action. Aucune page générée ne doit contenir une donnée d'élève ou de parent.
- Pas de nouvelle dépendance lourde ni de framework ; rester sur HTML + JS + un script Node.

## Règles de contenu

- Langue : français. Ton : chaleureux et professionnel, en **vouvoyant** les familles.
- **Ne jamais inventer** un chiffre, un avis, un diplôme, un résultat d'élève ou un tarif.
  Tarifs du site : Primaire 25 €/h, Collège 35 €/h, Lycée 40 €/h, Prépa bac 40 €/h
  (vérifier qu'ils sont identiques partout dans `index.html`). Les avis cités viennent uniquement de ceux déjà présents sur le site
  ou fournis par l'utilisateur.
- Nom exact partout : **Plume & Méthode** (esperluette, accent sur le é).
- Toujours « Bruay-la-Buissière **et** Béthune » (jamais Béthune seule).
- Pas de bourrage de mots-clés : chaque ville citée naturellement, quelques fois par page.
- Ne pas toucher au design, aux couleurs ni à la mise en page au-delà du nécessaire ;
  les nouvelles pages réutilisent les composants et styles existants.
- Ne jamais publier les données personnelles d'élèves.

## Vérifications avant de dire « terminé »

- Le build passe sans erreur.
- Chaque page s'ouvre directement par son URL (y compris après un rechargement).
- Le HTML brut de chaque page (sans JavaScript) contient son `<title>`, son `<h1>`
  et son texte principal.
- `robots.txt` et `sitemap.xml` sont générés, et le sitemap liste toutes les pages
  publiques en URL absolues `https://plume-methode.fr/…`.
- Le JSON-LD est un JSON valide, et `areaServed` contient Bruay-la-Buissière et Béthune.
- Le mot « Bruay-la-Buissière » apparaît dans le titre et le texte de l'accueil.
- Aucun lien interne ne pointe encore vers `#/…`.
- Plus aucune occurrence de `github.io/plume-sereine` dans les balises (canonical, og, JSON-LD).
- Servir le dossier en local (`npx serve .` ou `python -m http.server`) et vérifier :
  accueil, une page locale, `/blog/`, un article, un ancien lien `#/blog`, et la
  connexion à l'espace privé.

## Ce qui sort de ton périmètre

Fiche Google Business, Superprof, annuaires, Search Console : l'utilisateur s'en charge.
Tu peux seulement lui rappeler les étapes à la fin.
