# FirmeRO 🇷🇴

**Platformă gratuită de informații despre firme din România**

> Alternativă 100% gratuită la listafirme.ro, termene.ro și risco.ro

[![Deploy on Netlify](https://img.shields.io/badge/Deploy-Netlify-00C7B7?style=flat&logo=netlify)](https://netlify.com)
[![Backend on Railway](https://img.shields.io/badge/Backend-Railway-0B0D0E?style=flat&logo=railway)](https://railway.app)

## 🔥 Funcționalități

| Funcționalitate | Detalii |
|----------------|---------|
| 🔍 **Căutare** | După CUI sau denumire (cu backend Railway) |
| 🏢 **Profil Firmă** | Date ANAF live: denumire, adresă, statut, TVA |
| 💰 **Bilanțuri 10 Ani** | CA, profit, active, datorii, angajați + grafice Chart.js |
| ⚠️ **Scor Risc** | Algoritm Altman Z-Score adaptat pentru România |
| 📊 **Comparare** | 2-4 firme simultan, side-by-side |
| 🗺️ **Hartă** | Leaflet + OpenStreetMap, geocodare automată |
| 🔔 **Monitorizare** | Watchlist local, recent searches |
| 📥 **Export** | CSV pentru bilanțuri |

## 🚀 Utilizare

Deschide direct `index.html` în browser — fără server necesar.

**Sau** deploy pe Netlify/GitHub Pages (static, gratuit):
```
netlify deploy --dir=.
```

## 🔧 Backend Railway (opțional)

Backend-ul activează căutarea după **denumire** (nu doar CUI).

```bash
cd firme-ro-api
railway up
```

Configurează URL-ul în paginile HTML:
```html
<script>window.FIRME_API_URL = 'https://firme-ro-api.up.railway.app';</script>
```

## 📡 Surse de Date

- **ANAF** — Date fiscale, TVA, statut firmă (gratuit, public)
- **ANAF Bilanțuri** — Situații financiare anuale (gratuit, public)
- **OpenStreetMap / Nominatim** — Geocodare adrese (gratuit)
- **getcif.dev** — Fallback date firmă (gratuit)

## 📁 Structură

```
firme-ro/
├── index.html        # Homepage + căutare
├── firma.html        # Profil complet firmă
├── comparare.html    # Comparare firme
├── harta.html        # Hartă interactivă
├── statistici.html   # Statistici sectoriale
├── css/              # Design system dark mode glassmorphism
└── js/               # API ANAF, grafice, logică
```

## ⚖️ Legal

Date preluate din surse publice oficiale cu caracter public.
Platformă cu scop informativ. Nu constituie consultanță financiară sau juridică.

---
Made with ❤️ pentru antreprenorii români
