# Come impostare il nome utente in GBDrop

## Per utenti Windows

Il browser **non può accedere automaticamente** al nome utente di Windows per motivi di sicurezza e privacy.

### Soluzione: Imposta manualmente il tuo nome

1. Apri GBDrop nel browser: http://localhost:3000
2. Guarda in basso nella pagina, nel footer
3. Troverai un campo editabile con il nome del tuo dispositivo
4. **Clicca sul campo** e modifica il nome
5. Inserisci il tuo nome utente Windows (es. "gballari" o "Guido Ballarini")
6. Il nome verrà **salvato permanentemente** nel browser

### Come trovare il tuo nome utente Windows

Apri il Terminale PowerShell e digita:
```powershell
$env:USERNAME
```

Oppure:
```powershell
whoami
```

Il nome verrà mostrato (es. `COMPUTER\gballari`)

### Note

- Il nome viene salvato in **IndexedDB** (permanente)
- Se IndexedDB non è disponibile, viene salvato in **localStorage** (temporaneo per la sessione)
- Il nome personalizzato ha **priorità** sul nome del dispositivo rilevato automaticamente
- Altri dispositivi sulla rete vedranno il nome che hai impostato

## Per smartphone

Gli smartphone mostrano automaticamente il modello del dispositivo (es. "iPhone 13", "Samsung Galaxy S21")

Se vuoi cambiarlo, segui la stessa procedura degli utenti Windows.
