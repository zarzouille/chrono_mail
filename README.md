# chrono.mail

Outil en ligne pour générer des countdowns GIF à intégrer dans des emails marketing.

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
