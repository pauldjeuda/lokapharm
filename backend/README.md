# LokaPharm API

Backend d'agrégation pharmacies en temps réel pour l'application Ionic.

## Rôle

- Catalogue MINSANTE/DPML local (réponse instantanée)
- Enrichissement OpenStreetMap / Overpass (rayon ou bbox ville)
- Cache mémoire TTL + stale-while-revalidate (fluidité type Google Maps)
- Filtres : de garde, ouvert maintenant, 24h, distance, recherche texte
- Fusion géospatiale des doublons (< 80 m)

## Démarrage

```bash
cd backend
npm install
npm run dev
```

API : `http://localhost:3100`

## Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/health` | Santé du service |
| GET | `/api/pharmacies?lat=&lng=&city=&partial=1` | Liste (partial = catalogue rapide) |
| GET | `/api/pharmacies/:id?lat=&lng=` | Détail |

### Query params

- `lat`, `lng` (requis)
- `radiusKm` (défaut 8)
- `city` : `nearby` \| `yaounde` \| `douala`
- `onCall`, `openNow`, `open24h` : `1` / `true`
- `maxDistanceKm`, `q`, `limit`
- `partial=1` : catalogue seul, réponse immédiate
