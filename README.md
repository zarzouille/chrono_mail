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
