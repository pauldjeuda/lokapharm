# LokaPharm — Google Play Data safety & checklist

Document de préparation pour la fiche **Data safety** et la conformité Play Store.
À synchroniser avec la politique de confidentialité publique HTTPS.

## Déclarer dans Play Console → Data safety

| Donnée | Collectée ? | Partagée ? | Finalité | Obligatoire |
|--------|-------------|------------|----------|-------------|
| Localisation approximative | Oui (si autorisée) | Oui (API LokaPharm, OSM/OSRM) | Fonctionnalités de l’app | Non (peut refuser) |
| Localisation précise | Oui (si autorisée) | Oui | Fonctionnalités de l’app | Non |
| Infos personnelles (nom, email) | Non | — | — | — |
| Santé | Non (v1) | — | — | — |
| Photos / fichiers | Non (v1) | — | — | — |
| Identifiants appareil / pub | Non | — | — | — |
| Données financières | Non | — | — | — |

- **Publicité** : Non  
- **Suivi (tracking)** : Non  
- **Chiffrement en transit** : Oui (HTTPS)  
- **Les utilisateurs peuvent demander la suppression** : Oui (désinstaller / effacer données app — favoris locaux)

## Privacy policy URL (obligatoire Play)

Publier en HTTPS (status 200) :
- `https://lokapharm.cm/privacy`
- `https://lokapharm.cm/terms`

Sources prêtes à déployer : `src/assets/legal/privacy.html` et `terms.html`.

Versions in-app : Profil → Politique / Conditions (modal).

## API production

Déployer le backend (`backend/`) derrière HTTPS :
- Healthcheck : `https://api.lokapharm.cm/health` → `{ ok: true }`
- Variables : `NODE_ENV=production`, `CORS_ORIGINS=...`, `RATE_LIMIT_MAX=120`
- Reverse proxy avec HSTS

## Signature AAB

```bash
# Créer un keystore (une seule fois — sauvegarder hors git)
keytool -genkey -v -keystore lokapharm-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias lokapharm

# Build signé
set ANDROID_KEYSTORE_FILE=C:\path\lokapharm-upload.jks
set ANDROID_KEYSTORE_PASSWORD=...
set ANDROID_KEY_ALIAS=lokapharm
set ANDROID_KEY_PASSWORD=...
cd android && .\gradlew bundleRelease
```

## Listing store

- Icône 512×512
- Feature graphic 1024×500
- 2–8 screenshots téléphone (FR)
- Description : préciser « outil d’information, pas un dispositif médical »
- Catégorie : Santé / Médical (information)
- Content rating questionnaire

## Texte store recommandé (extrait)

> LokaPharm aide à trouver des pharmacies au Cameroun grâce à la carte et à la géolocalisation.
> Application d’information et d’orientation — ne remplace pas un avis médical ou pharmaceutique.

## Checklist avant upload

- [ ] Privacy URL publique 200 HTTPS
- [ ] API prod health 200
- [ ] AAB signé avec keystore upload
- [ ] Data safety rempli (cohérent avec privacy)
- [ ] Content rating
- [ ] Screenshots + feature graphic
- [ ] Disclaimer 1er lancement (implémenté)
- [ ] Target SDK ≥ exigence Play (35)
- [ ] Pas de cleartext / pas de background location
