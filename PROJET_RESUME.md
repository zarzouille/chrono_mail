# Chrono.mail — Résumé de projet
> **Document préparé par Claude (chat) pour passation à Claude Code**
> Dernière mise à jour : mars 2026

---

## 🎯 Concept

**Chrono.mail** est un SaaS de génération de timers GIF animés pour emails marketing.
L'utilisateur configure un countdown (date cible, couleurs, style, orientation…), le serveur génère un GIF animé hébergé, et l'utilisateur colle une balise `<img>` dans son outil d'emailing (Klaviyo, Mailchimp, Brevo…).

---

## 🏗 Stack technique

| Couche | Technologie |
|---|---|
| Frontend | HTML/CSS/JS vanilla (SPA sans framework) |
| Backend | Node.js + Express |
| Base de données | PostgreSQL via Supabase |
| ORM | Prisma |
| Génération GIF | `@napi-rs/canvas` + `gif-encoder-2` |
| Auth | JWT maison + Google OAuth (Passport.js) |
| Paiement | Stripe (Checkout + portail de facturation) |
| Hébergement | Render (backend) + Render Static (frontend) |

---

## 📁 Structure du projet

```
chrono_mail/
├── backend/
│   ├── routes/
│   │   ├── api.js              — CRUD countdowns + endpoint /gif preview
│   │   ├── auth-routes.js      — Login / Register / Google OAuth
│   │   └── stripe-routes.js    — Checkout + portail de facturation
│   ├── services/
│   │   └── countdown-generator.js  — Génération GIF canvas (horizontal/vertical)
│   ├── lib/
│   │   ├── auth.js             — Middleware JWT requireAuth
│   │   ├── prisma.js           — Instance Prisma singleton
│   │   └── passport.js         — Config Google OAuth
│   └── app.js                  — Entrée Express
├── frontend/
│   └── public/
│       ├── index.html          — SPA complète (toutes les pages)
│       ├── script.js           — Toute la logique JS (~836 lignes)
│       └── style.css           — Tous les styles (~400 lignes)
└── prisma/
    └── schema.prisma           — Schéma base de données
```

---

## 🗄 Schéma Prisma (état actuel)

### Model `Countdown`
```prisma
id               String   @id @default(cuid())
userId           String
name             String
endDate          DateTime
timezone         String   @default("Europe/Paris")

// Apparence (tous plans)
bgColor          String   @default("#ffffff")
textColor        String   @default("#2563eb")
fontSize         Int      @default(36)
width            Int      @default(400)
fontFamily       String   @default("monospace")
style            String   @default("rounded")       // rounded | flat | bordered
orientation      String   @default("horizontal")    // horizontal | vertical ← NOUVEAU
showUnits        String   @default("days,hours,minutes,seconds") ← NOUVEAU

// Labels personnalisés (Pro)
labelDays        String   @default("JOURS")
labelHours       String   @default("HEURES")
labelMinutes     String   @default("MIN")
labelSeconds     String   @default("SEC")

// Post-expiration
expiredBehavior  ExpiredBehavior @default(SHOW_ZEROS)
expiredText      String?
expiredImageUrl  String?
expiredRedirect  String?         // Pro uniquement

// Pro
bgImageUrl       String?

// Business
perpetual        Boolean  @default(false)
perpetualSeconds Int      @default(86400)

clickUrl         String?
active           Boolean  @default(true)
```

### Enums
```prisma
enum Plan            { FREE  PRO  BUSINESS }
enum ExpiredBehavior { SHOW_ZEROS  SHOW_TEXT  SHOW_IMAGE  REDIRECT  HIDE }
```

---

## 💰 Plans tarifaires

| Feature | Free | Pro (9€/mois) | Business (29€/mois) |
|---|---|---|---|
| Countdowns | 3 max | Illimités | Illimités |
| Labels personnalisés | ✗ | ✓ | ✓ |
| Redirection expiration | ✗ | ✓ | ✓ |
| Image de fond | ✗ | ✓ | ✓ |
| Analytics avancées | ✗ | ✓ | ✓ |
| Timer perpétuel | ✗ | ✗ | ✓ |
| API access | ✗ | ✗ | ✓ |

---

## ✅ Ce qui est implémenté et fonctionnel

### Auth
- [x] Register / Login avec email + mot de passe (JWT)
- [x] Google OAuth (Passport.js)
- [x] Middleware `requireAuth` sur toutes les routes protégées
- [x] Session persistée dans localStorage (`cm_token`, `cm_user`)

### Paiement Stripe
- [x] Checkout Session (Pro mensuel, Pro annuel, Business mensuel, Business annuel)
- [x] Portail de facturation client
- [x] Webhook Stripe pour mise à jour du plan en base
- [x] Retours URL checkout (success / cancelled)

### Génération GIF
- [x] Canvas Node.js avec `@napi-rs/canvas`
- [x] 10 frames animées (1 seconde par frame, boucle infinie)
- [x] Style **rounded** / **flat** / **bordered**
- [x] Orientation **horizontale** et **verticale**
- [x] Unités masquables (ex: masquer "Jours" → champ `showUnits`)
- [x] Police configurable (monospace / sans-serif / serif / cursive)
- [x] Couleur texte + couleur fond configurables
- [x] Labels personnalisés (Pro)
- [x] Comportement post-expiration : SHOW_ZEROS / SHOW_TEXT / REDIRECT
- [x] Image de fond optionnelle (Pro, `bgImageUrl`)
- [x] Timer perpétuel (Business, `perpetual` + `perpetualSeconds`)
- [x] Log des impressions en arrière-plan

### Page Create (formulaire)
- [x] 4 étapes en accordéons avec barre de progression linéaire
- [x] Preview GIF **live** (vrai GIF serveur, debounce 500ms, sans bouton)
- [x] Spinner de chargement pendant la génération preview
- [x] Badge "Chargement / Live / Erreur" dans la preview
- [x] Color picker natif pleine largeur (pastille + code hex live)
- [x] Toggle orientation horizontal / vertical
- [x] Checkboxes unités affichées (Jours / Heures / Minutes / Secondes)
- [x] Taille police 20–50px (max bloqué à 50)
- [x] Plan gates : overlay verrouillé sur options Pro
- [x] **Modale upgrade contextuelle** au clic sur élément verrouillé
    - Texte différent selon la feature (labels vs redirect)
    - Liste des avantages Pro
    - Bouton "Passer à Pro" → Stripe Checkout
    - Fermeture par Échap ou clic en dehors
- [x] 4 onglets de code après publication : Minimal / Standard / Klaviyo / Mailchimp
- [x] Copie du code HTML et de l'URL GIF

### Dashboard
- [x] Liste des countdowns avec statut actif/expiré
- [x] Compteur d'impressions par countdown
- [x] Quota Free (3 max) avec barre de progression
- [x] Bouton "Upgrade" ou "Gérer abonnement" selon plan
- [x] Carte "+" pour créer un nouveau countdown

### Pages
- [x] Landing page (hero, stats, steps, CTA)
- [x] Page Pricing avec toggle mensuel/annuel
- [x] FAQ contextuelle selon le plan de l'utilisateur
- [x] Pages Login / Register

---

## ❌ Ce qui reste à faire

### Priorité haute (avant lancement commercial)
- [ ] **Pages légales** — Politique de confidentialité, CGU, Cookies (RGPD obligatoire)
- [ ] **Page Contact** — Formulaire ou lien email
- [ ] **Styles de countdown supplémentaires** — Glassmorphism, Circulaire, Dark pill (Pro), Split-flap/Neon (Business) — roadmap définie mais non implémentée
- [ ] **Analytics dashboard** — Courbe d'impressions dans le temps par countdown (Pro/Business)
- [ ] **Suppression de countdown** — Bouton dans le dashboard (route DELETE existe côté API mais pas d'UI)
- [ ] **Édition d'un countdown existant** — Reprise du formulaire avec les valeurs sauvegardées

### Priorité moyenne
- [ ] **Webhook Stripe complet** — Gérer `customer.subscription.deleted` pour downgrade automatique vers Free
- [ ] **Emails transactionnels** — Confirmation d'inscription, facture, alerte expiration countdown
- [ ] **Image de fond (Pro)** — Upload côté frontend + stockage (S3 ou Cloudinary) — le champ `bgImageUrl` existe en base mais l'UI n'est pas faite
- [ ] **Timer perpétuel (Business)** — Champ `perpetual` + `perpetualSeconds` existe en base et dans le générateur, mais pas d'UI dans le formulaire
- [ ] **Page d'intégration ESP** — Guides visuels Klaviyo / Mailchimp / Brevo

### Priorité basse / roadmap future
- [ ] **Équipe (Business)** — Invitations membres, accès partagés
- [ ] **API publique (Business)** — Génération programmatique de countdowns
- [ ] **Domaine custom** — Héberger les GIFs sur le domaine du client
- [ ] **A/B testing** — Variantes de countdown dans une même campagne
- [ ] **Internationalisation** — Labels auto en FR/EN/ES/DE

---

## 🎨 Design system

Toutes les variables CSS sont dans `style.css` :
```css
--accent: #2563eb   /* bleu principal */
--green:  #16a34a   /* succès */
--orange: #f97316   /* warning / Free plan */
--red:    #dc2626   /* erreur */
--bg:     #f8f7f4   /* fond page */
--surface:#ffffff   /* fond cartes */
```
Police principale : **Plus Jakarta Sans** (Google Fonts)
Police monospace : **JetBrains Mono** (Google Fonts)

---

## ⚠️ Points d'attention pour Claude Code

1. **Prisma client** — Après tout changement de `schema.prisma`, toujours faire `npx prisma generate` puis redémarrer le serveur. Juste `npx prisma db push` ne suffit pas.

2. **Structure SPA** — Tout est dans un seul `index.html`. Les "pages" sont des `<div class="page">` affichées/masquées par `showPage()` dans `script.js`. Pas de router.

3. **Preview GIF** — L'endpoint `/gif` (sans ID) génère un GIF à la volée sans sauvegarde. L'endpoint `/gif/:id` sert le GIF d'un countdown sauvegardé en base.

4. **Plan gates** — Les restrictions par plan sont enforced **côté backend** dans `api.js` (ne pas se fier uniquement au JS frontend).

5. **Stripe prix IDs** — Les price IDs Stripe sont dans `stripe-routes.js`. En dev ils pointent vers Stripe Test Mode.