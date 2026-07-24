# LPB Machines API V3 - Installation

Copier le dossier `api` dans :

`C:\Users\thoma\machines-lpb\frontend\api`

Le fichier `frontend/vercel.json` actuel peut être conservé : il redirige déjà `/api/(.*)` vers `/api/index.js`.

Variables Vercel nécessaires :

- `DATABASE_URL`
- `ADMIN_API_KEY`
- `CRM_API_KEY`
- `PENNYLANE_API_KEY`
- `APP_BASE_URL=https://machines.lpbtorrefaction.fr`

Commandes Windows CMD depuis `C:\Users\thoma\machines-lpb\frontend` :

```cmd
npm run build
git add .
git commit -m "refactor: deploy Machines API V3 on CRM clients schema"
git push
```

Test production :

- ouvrir `https://machines.lpbtorrefaction.fr`
- vérifier que la liste des clients se charge sans erreur `column nom does not exist`
- vérifier la liste des machines
- ouvrir une fiche machine et contrôler l'historique

Important : `POST /api/clients` renvoie désormais 405, car les clients sont propriétaires du CRM.
