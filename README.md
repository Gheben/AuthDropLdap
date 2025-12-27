# AuthDrop

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

Il server sarà disponibile su `http://localhost:3000`

## Sviluppo

```bash
# Modalità sviluppo
npm run dev
```

## Deployment

### Con Docker

```bash
docker build -t AuthDrop .
docker run -d --restart=unless-stopped --name=AuthDrop -p 127.0.0.1:3000:3000 AuthDrop
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

### Nome Utente Automatico
AuthDrop supporta tre modi per impostare automaticamente il tuo nome:

1. **Script PowerShell** (Windows): Usa `launch-AuthDrop.ps1` per aprire il browser con il tuo nome utente già impostato
2. **Parametro URL**: Apri `http://localhost:3000?username=TuoNome`
3. **Bookmarklet**: Salva un segnalibro per impostare il nome con un click

Vedi [GUIDA_NOME_UTENTE.md](GUIDA_NOME_UTENTE.md) per i dettagli.

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
