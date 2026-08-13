# Chronomail

Outil en ligne pour générer des countdowns GIF à intégrer dans des emails marketing.

## Environnement de développement

Le `.env` local ne doit **jamais** pointer sur la base de production. Une
machine de dev exécute le planificateur : purges et campagnes de relance
tourneraient alors sur les données réelles, ce qui est déjà arrivé.

La base de dev est un conteneur PostgreSQL local :

```
docker start chronomail-dev-db     # démarrer (créé une fois pour toutes)
docker stop  chronomail-dev-db     # arrêter
npm run seed:dev                   # remettre des données d'exemple
```

Elle écoute sur le port **5433** pour ne pas entrer en conflit avec une
autre instance PostgreSQL, et conserve ses données dans le volume Docker
`chronomail-dev-data`. Si le conteneur a été supprimé, le recréer avec :

```
docker run -d --name chronomail-dev-db --restart unless-stopped \
  -e POSTGRES_PASSWORD=chronomail_dev_local -e POSTGRES_USER=chronomail \
  -e POSTGRES_DB=chronomail_dev -p 5433:5432 \
  -v chronomail-dev-data:/var/lib/postgresql/data postgres:16-alpine
```

`npm run seed:dev` vide les tables avant d'écrire ; il refuse de démarrer
si `DATABASE_URL` contient l'identifiant du projet Supabase de production.
Il crée un compte `dev@chronomail.local` / `devdev123` en plan Business,
trois countdowns et une demande de support.

En local, `DISABLE_CRON=true` doit rester dans le `.env`. La configuration
de production vit dans Render → Environment, et nulle part ailleurs.

Pour appliquer un changement de schéma à la production, le faire
délibérément, en fournissant l'URL le temps d'une seule commande :

```
$env:DATABASE_URL="<url de production>"; npx prisma db push
```

## Base de données (Prisma)

Le projet n'utilise pas `prisma migrate` : le schéma est appliqué avec
`npx prisma db push` (pas de dossier `prisma/migrations/`).

Après tout `git pull` (ou changement local) qui touche `prisma/schema.prisma`,
relancer :

```
npx prisma generate
```

Sans ça, le client Prisma déjà généré dans `node_modules/@prisma/client`
reste périmé par rapport au schéma : les champs ajoutés récemment (ex.
`emailVerifyToken`, `resetToken`, `emailVerified`) sont alors rejetés à
l'exécution avec une erreur du type `Unknown argument ...`, même si le
schéma et la base sont, eux, parfaitement synchronisés.

## Aperçu des emails

`/email-preview` affiche les templates transactionnels avec des données
fictives. La route est **fermée par défaut** et ne s'ouvre que si la
variable suivante est définie :

```
EMAIL_PREVIEW=true
```

À mettre dans votre `.env` local, **jamais** dans les variables
d'environnement de production : la route exposerait publiquement tous les
templates. Le garde est volontairement en « fail-closed » — il n'utilise
pas `NODE_ENV`, dont l'absence sur l'hébergeur avait justement laissé la
route ouverte en production.

## Jobs planifiés

Trois relances sont envoyées par `node-cron` depuis `backend/lib/scheduler.js`
(activation à 48h, win-back à 14 jours, réactivation à 30 jours). Au
démarrage, le serveur logue une ligne `⏱️ [CRON]` par job : leur absence
signale que `DISABLE_CRON=true` est actif.

Réglages : `DISABLE_CRON`, `CRON_TIMEZONE` (défaut `Europe/Paris`),
`CRON_ACTIVATION_NUDGE`, `CRON_WINBACK`, `CRON_REACTIVATION`.
