# 🚀 Come impostare il nome utente in GBDrop

GBDrop ora supporta **tre modi** per impostare automaticamente il tuo nome utente Windows!

## 🎯 Metodo 1: Script di lancio automatico (CONSIGLIATO)

Usa lo script PowerShell `launch-gbdrop.ps1` per aprire GBDrop con il tuo nome utente già impostato:

1. **Doppio click** su `launch-gbdrop.ps1` nella cartella del progetto
2. Il browser si apre automaticamente con il tuo nome utente Windows
3. Il nome viene salvato permanentemente (non serve ripetere)

**In alternativa**, crea un collegamento sul Desktop:
- Tasto destro su `launch-gbdrop.ps1` → **Crea collegamento**
- Sposta il collegamento sul Desktop
- Rinominalo in "GBDrop"

### Come funziona
Lo script:
1. Ottiene il nome utente da `$env:USERNAME`
2. Apre il browser con URL: `http://localhost:3000?username=TUONOMEUTENTE`
3. GBDrop legge il parametro e salva il nome automaticamente in IndexedDB

---

## 🔖 Metodo 2: Bookmarklet (per uso rapido)

Crea un segnalibro nel browser che imposta il nome con un click:

1. Crea un **nuovo segnalibro** nella barra dei preferiti
2. **Nome**: "Imposta nome GBDrop"
3. **URL**: Copia e incolla questo codice:

```javascript
javascript:(function(){const name=prompt('Inserisci il tuo nome utente:',document.querySelector('%23display-name').getAttribute('placeholder'));if(name){const event=new CustomEvent('self-display-name-changed',{detail:name});window.dispatchEvent(event);fetch('/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:name})}).catch(()=>{});alert('Nome impostato: '+name);}})();
```

**Come usare**:
- Apri GBDrop normalmente
- Clicca sul bookmarklet
- Inserisci il tuo nome utente (o lascia il nome suggerito)
- Premi OK

---

## 🌐 Metodo 3: URL diretto con parametro

Puoi aggiungere il parametro `?username=` direttamente nell'URL del browser:

```
http://localhost:3000?username=gballari
```

Oppure:

```
http://localhost:3000?displayName=Guido%20Ballarini
```

**Nota**: Gli spazi devono essere codificati come `%20`

---

## ℹ️ Come ottenere il tuo nome utente Windows

### PowerShell:
```powershell
$env:USERNAME
```

### CMD:
```cmd
echo %USERNAME%
```

### Whoami (nome completo dominio\utente):
```powershell
whoami
```

---

## 💾 Dove viene salvato il nome?

Il nome viene salvato nel browser usando **due sistemi**:

1. **IndexedDB** (permanente, sopravvive ai riavvii)
   - Database: `gbdrop_store`
   - Key: `edited_display_name`
   - Priorità: **Alta**

2. **localStorage** (fallback se IndexedDB non disponibile)
   - Key: `edited_display_name`
   - Priorità: **Bassa**

**Il nome viene salvato UNA SOLA VOLTA e persiste per sempre** (fino a quando non lo modifichi manualmente o cancelli i dati del browser).

---

## 🔒 Perché il browser non può accedere automaticamente al nome Windows?

Per motivi di **privacy e sicurezza**, i browser moderni non permettono ai siti web di accedere a informazioni del sistema operativo come:
- Nome utente Windows
- Nome computer
- Dominio di rete
- Altre informazioni personali

Questo è un comportamento corretto e protegge la tua privacy quando navighi su Internet.

---

## 🎯 Quale metodo scegliere?

| Metodo | Velocità | Automatico | Riutilizzabile |
|--------|----------|------------|----------------|
| **Script PowerShell** | ⭐⭐⭐ | ✅ Sì | ✅ Sì (collegamento) |
| **Bookmarklet** | ⭐⭐ | ❌ No | ✅ Sì (sempre disponibile) |
| **URL manuale** | ⭐ | ❌ No | ❌ No |

**Raccomandazione**: Usa lo **script PowerShell** per la massima comodità!

---

## 📱 Per smartphone

Gli smartphone mostrano automaticamente il modello del dispositivo (es. "iPhone 13", "Samsung Galaxy S21").

Se vuoi cambiarlo, puoi modificarlo manualmente cliccando sul nome in fondo alla pagina.
