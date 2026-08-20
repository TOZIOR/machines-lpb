# Contrat API CRM -> LPB Machines : liste clients

LPB Machines appelle l'URL définie dans `CRM_CLIENTS_URL`.

## Authentification

Le backend Machines envoie les deux en-têtes suivants :

- `Authorization: Bearer <CRM_CLIENTS_API_KEY>`
- `x-api-key: <CRM_CLIENTS_API_KEY>`

## Réponse acceptée

Le CRM peut répondre directement avec un tableau ou avec une propriété `clients`, `data` ou `items`.

Exemple recommandé :

```json
{
  "clients": [
    {
      "id": "uuid-crm",
      "nom": "Hôtel Exemple",
      "pennylaneCustomerId": "pennylane-id",
      "adresse": "1 rue Exemple, 21000 Dijon",
      "telephone": "03 80 00 00 00",
      "email": "contact@example.fr"
    }
  ]
}
```

Le champ `pennylaneCustomerId` est essentiel pour relier sans duplication le CRM, Pennylane et les machines déjà affectées.
