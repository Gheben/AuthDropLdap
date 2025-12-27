# 🚀 Script di Lancio GBDrop

Questo script automatizza l'apertura di GBDrop con il tuo nome utente Windows già impostato.

## 📋 Requisiti

- Windows con PowerShell (già installato su Windows 10/11)
- GBDrop in esecuzione su `http://localhost:3000`

## 🎯 Uso Base

### Opzione 1: Doppio Click
Semplicemente fai **doppio click** su `launch-gbdrop.ps1`

### Opzione 2: Da PowerShell
```powershell
.\launch-gbdrop.ps1
```

## 🖥️ Creare un Collegamento sul Desktop

1. Tasto destro su `launch-gbdrop.ps1`
2. **Invia a** → **Desktop (crea collegamento)**
3. Rinomina il collegamento in "GBDrop"
4. (Opzionale) Cambia l'icona:
   - Tasto destro sul collegamento → **Proprietà**
   - **Cambia icona...** → Sfoglia
   - Seleziona `public\images\logo_blue_512x512.png` dalla cartella GBDrop

## ⚙️ Personalizzazione

### Cambiare l'URL del Server

Se GBDrop è in esecuzione su un altro indirizzo (es. server remoto), modifica la riga:

```powershell
$gbdropUrl = "http://localhost:3000"
```

Con l'URL corretto, ad esempio:

```powershell
$gbdropUrl = "https://gbdrop.ballarini.app"
```

### Usare un Nome Diverso

Se vuoi usare un nome diverso dal nome utente Windows:

```powershell
$username = "Guido Ballarini"  # invece di $env:USERNAME
```

### Aprire in un Browser Specifico

Per aprire in un browser specifico invece del predefinito:

**Chrome:**
```powershell
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
Start-Process $chromePath $fullUrl
```

**Edge:**
```powershell
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
Start-Process $edgePath $fullUrl
```

**Firefox:**
```powershell
$firefoxPath = "C:\Program Files\Mozilla Firefox\firefox.exe"
Start-Process $firefoxPath $fullUrl
```

## 🔒 Politica di Esecuzione PowerShell

Se ricevi un errore di "Execution Policy", esegui questo comando in PowerShell **come Amministratore**:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Oppure, per eseguire lo script una tantum:

```powershell
PowerShell.exe -ExecutionPolicy Bypass -File .\launch-gbdrop.ps1
```

## 🔄 Avvio Automatico all'Accesso Windows

Per far partire GBDrop automaticamente all'accesso:

1. Premi `Win + R`
2. Digita: `shell:startup`
3. Premi Invio
4. Copia il collegamento a `launch-gbdrop.ps1` in questa cartella

**Nota:** Assicurati che il server GBDrop sia in esecuzione (puoi usare Task Scheduler per avviare anche il server automaticamente).

## 📝 Come Funziona

Lo script:

1. 🔍 Ottiene il nome utente Windows da `$env:USERNAME`
2. 🔗 Costruisce l'URL: `http://localhost:3000?username=TUONOMEUTENTE`
3. 🌐 Apre il browser predefinito con questo URL
4. 💾 GBDrop legge il parametro `username` e lo salva automaticamente in IndexedDB

Il nome viene salvato **permanentemente** nel browser, quindi dovrai eseguire lo script solo la prima volta (o quando cambi browser/device).

## 🛠️ Troubleshooting

### Lo script non si apre
- Verifica di avere i permessi di esecuzione PowerShell
- Prova a eseguire come amministratore

### Il browser non si apre
- Controlla che `Start-Process` funzioni con URL semplici:
  ```powershell
  Start-Process "https://www.google.com"
  ```

### GBDrop non riceve il nome
- Verifica che il server sia in esecuzione su porta 3000
- Controlla la console del browser per errori JavaScript
- Verifica che il file `ui-main.js` contenga la funzione `_checkUrlParameters()`

### Il nome non viene salvato
- Controlla che IndexedDB sia abilitato nel browser
- Verifica in Console del browser: `IndexedDB`
- Apri DevTools → Application → IndexedDB → `gbdrop_store`

## 📚 Vedi Anche

- [GUIDA_NOME_UTENTE.md](GUIDA_NOME_UTENTE.md) - Guida completa con tutti i metodi
- [test-bookmarklet.html](test-bookmarklet.html) - Test dei bookmarklet alternativi
- [README.md](README.md) - Documentazione principale GBDrop
