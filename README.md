# AuthDrop

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![Express](https://img.shields.io/badge/Express-4.x-blue.svg)
![SQLite3](https://img.shields.io/badge/SQLite3-Latest-lightblue.svg)
![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![Platform](https://img.shields.io/badge/Platform-Windows%20|%20Linux%20|%20macOS-lightgrey.svg)

**Un'applicazione web moderna per il trasferimento di file peer-to-peer direttamente nel browser**

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support%20-yellow.svg?logo=buy-me-a-coffee&logoColor=white)](https://buymeacoffee.com/guidoballau)

</div>

---

**AuthDrop** è un'applicazione web per il trasferimento di file peer-to-peer che funziona direttamente nel browser, senza bisogno di installazione.

## Caratteristiche

- 🔄 Trasferimento file peer-to-peer via WebRTC
- 🌐 Funziona completamente nel browser (PWA)
- 🔒 Connessione diretta e sicura tra dispositivi
- 📱 Supporto multi-piattaforma (Windows, Mac, Linux, iOS, Android)
- 💾 Nessun limite di dimensione file
- 🚀 Velocità di trasferimento limitata solo dalla tua rete
- 🌍 Supporto per 35+ lingue
- 🎨 Tema chiaro e scuro automatico
- 📴 Funziona offline dopo la prima visita
- 🔐 Privacy totale: i file non passano mai da server esterni

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
cd AuthDrop

# Installa le dipendenze
npm install

# Avvia il server
npm start
```

Il server sarà disponibile su `http://localhost:3441`

## Sviluppo

```bash
# Modalità sviluppo
npm run dev
```

## Deployment

### Con Docker

```bash
docker build -t AuthDrop .
docker run -d --restart=unless-stopped --name=AuthDrop -p 127.0.0.1:3441:3441 AuthDrop
```

### Con Node.js

```bash
npm run start:prod
```

## Struttura del Progetto

```
AuthDrop/
├── public/           # File frontend (HTML, CSS, JS, immagini)
├── server/           # Backend Node.js
├── package.json      # Configurazione npm
└── README.md        # Questo file
```

## Come Funziona

1. Apri AuthDrop nel browser su tutti i dispositivi che vuoi connettere
2. I dispositivi sulla stessa rete locale si rilevano automaticamente
3. Clicca sul dispositivo di destinazione e seleziona i file da inviare
4. Il trasferimento avviene direttamente tra i dispositivi (P2P)

## Funzionalità Avanzate

### Accoppiamento Dispositivi
Puoi accoppiare permanentemente i tuoi dispositivi inserendo una stanza condivisa, anche se sono su reti diverse.

## FAQ

**È sicuro?**  
Sì, i file vengono trasferiti direttamente tra i tuoi dispositivi usando WebRTC. Non passano da server esterni.

**Funziona senza internet?**  
Sì, sulla rete locale funziona anche offline. Serve internet solo per il server di signaling iniziale.

**Quali browser supporta?**  
Tutti i browser moderni: Chrome, Edge, Firefox, Safari, Opera.

**Posso usarlo con dispositivi su reti diverse?**  
Sì, usando la funzione di accoppiamento con codice stanza condiviso.

## Autore

Guido Ballarini - [git.ballarini.app](https://git.ballarini.app/guido/AuthDrop)

## Licenza

GPL-3.0
