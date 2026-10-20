# Chantiers du site — dans l'ordre

Cocher au fur et à mesure. Un commit Git par tâche.

## 1. Accueil : Bruay + Béthune partout
- [x] `<title>`, meta description et `<h1>` repris de `infos-reference.md`
- [x] Dans le texte : « Béthune et alentours » → « Bruay-la-Buissière, Béthune et alentours »
- [x] Balises Open Graph (`og:title`, `og:description`, `og:url`, `og:image`, `og:locale=fr_FR`)
- [x] **Corriger l'URL officielle** : canonical, `og:url` et `url` du JSON-LD passent de
  `https://morgandecoopman40.github.io/plume-sereine` à `https://plume-methode.fr/`
  (priorité n°1 : aujourd'hui le site dit à Google que sa vraie adresse est github.io)

**Réussi si** : « Bruay-la-Buissière » figure dans le title, le h1 et le texte de l'accueil.

## 2. Balisage Schema (JSON-LD)
- [x] Partir de `modeles/schema-localbusiness.json` en conservant ce qui est juste dans l'actuel
- [x] `areaServed` : Bruay-la-Buissière, Béthune, Divion, Houdain, Haillicourt, Auchel
- [x] `telephone`, `url`, `name` exacts ; tarifs dans `makesOffer` uniquement s'ils sont vérifiés
- [x] Pas de note/`aggregateRating` (Google ne l'accepte pas pour des avis auto-publiés)

**Réussi si** : JSON valide, accepté par le test des résultats enrichis de Google.
(JSON valide et conforme au vocabulaire schema.org ; test Google à faire après mise en ligne.)

## 3. Sortir des URL à dièse
- [x] Une vraie URL par page (voir tableau dans `infos-reference.md`), sous forme de
  dossier + `index.html` (GitHub Pages n'a pas de réécriture d'URL)
- [x] Script `scripts/generer-blog.mjs` : lit les articles publiés dans Supabase (clé anon,
  lecture seule) et écrit `/blog/index.html` + `/blog/<slug>/index.html`
- [x] GitHub Action : génération au push, chaque nuit et à la demande, puis déploiement Pages
  (passer la source Pages sur « GitHub Actions » — à faire par l'utilisateur, l'indiquer)
- [x] HTML de chaque page : titre, h1 et texte présents sans JavaScript
- [x] Title, meta description et canonical propres à chaque page
- [x] Redirection des anciens liens `#/blog`, `#/cgv`… vers les nouvelles URL
- [x] Plus aucun lien interne en `#/…` ; menu, pied de page et liens « 🔗 » de l'admin mis à jour
- [ ] Espace privé et tableau de bord testés : rien de cassé
  (testé sans connexion : ouverture de la connexion, tableau de bord caché, aucune erreur JS ;
  connexion réelle, élèves, contrats, éditeur d'articles : à tester par l'utilisateur)

**Réussi si** : chaque URL s'ouvre directement et après rechargement, et son HTML brut contient son contenu.

## 4. robots.txt et sitemap.xml
- [x] `robots.txt` d'après `modeles/robots.txt`
- [x] `sitemap.xml` généré automatiquement au build si possible (sinon à la main), toutes les pages publiques, URL absolues, `lastmod`
- [x] Exclure du sitemap toute page privée / espace élèves éventuel

**Réussi si** : `/robots.txt` et `/sitemap.xml` répondent 200 après build.

## 5. Pages locales et par besoin
- [x] `/cours-francais-bruay-la-buissiere`
- [x] `/cours-francais-bethune`
- [x] `/preparation-bac-francais`
- [x] `/preparation-brevet-francais`
- [x] Liens vers ces pages depuis l'accueil et le pied de page ; liens croisés entre elles

Suivre les plans de `modeles/pages-locales.md`. Les deux pages villes doivent avoir
un texte réellement différent (pas de copier-coller en changeant le nom de la ville).

**Réussi si** : 4 pages présentes dans le sitemap, chacune avec tarifs, méthode, FAQ et appel au contact.

## 6. Blog prêt pour un article par mois
- [x] Page `/blog` listant les articles, article existant sur sa vraie URL
- [x] Justine continue d'écrire dans l'admin ; l'article devient une vraie page à la
  génération suivante (nuit, ou relance manuelle de l'action)
- [x] Chaque article généré : title, meta description (champ `description`), date,
  auteur (Justine), image avec `alt`, lien vers une page locale, données `Article` en JSON-LD
- [x] Expliquer à l'utilisateur, en 5 lignes, comment publier le prochain article

## 7. Finitions
- [x] Attributs `alt` descriptifs sur les images ; images compressées
- [x] Une seule balise `<h1>` par page, hiérarchie h2/h3 cohérente
- [x] Téléphone cliquable (`tel:+33671086161`) sur toutes les pages
- [x] Page 404 propre avec lien vers l'accueil
- [x] Récapitulatif final + étapes Search Console pour l'utilisateur
