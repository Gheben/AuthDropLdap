# GBDrop

**GBDrop** è una versione personalizzata di [PairDrop](https://github.com/schlagmichdoch/pairdrop) - un'applicazione per il trasferimento di file peer-to-peer, simile ad AirDrop.

## Caratteristiche

- 🔄 Trasferimento file peer-to-peer via WebRTC
- 🌐 Funziona nel browser web (PWA)
- 🔒 Connessione diretta e sicura
- 📱 Supporto multi-piattaforma (Windows, Mac, Linux, iOS, Android)
- 🎨 Interfaccia personalizzata con loghi GBDrop

## Tecnologie

- **Frontend**: HTML5, CSS3, JavaScript ES6
- **Backend**: Node.js con Express
- **Comunicazione**: WebRTC e WebSockets
- **PWA**: Progressive Web App

## Installazione

### Prerequisiti

- Node.js >= 15.0.0
- npm

### Istruzioni

```bash
# Clona o scarica questo repository
cd gbdrop

# Installa le dipendenze
npm install

# Avvia il server
npm start
```

Il server sarà disponibile su `http://localhost:3000`

## Sviluppo

```bash
# Modalità sviluppo
npm run dev
```

## Deployment

### Con Docker

```bash
docker build -t gbdrop .
docker run -d --restart=unless-stopped --name=gbdrop -p 127.0.0.1:3000:3000 gbdrop
```

### Con Node.js

```bash
npm run start:prod
```

## Struttura del Progetto

```
gbdrop/
├── public/           # File frontend (HTML, CSS, JS, immagini)
├── server/           # Backend Node.js
├── package.json      # Configurazione npm
└── README.md        # Questo file
```

## Personalizzazioni

Questa versione include:
- ✅ Loghi personalizzati GBDrop
- ✅ Colori e temi personalizzati
- ✅ Configurazioni specifiche

## Crediti

Basato su [PairDrop](https://github.com/schlagmichdoch/pairdrop) di schlagmichdoch.

## Licenza

GPL-3.0 - Vedi LICENSE
