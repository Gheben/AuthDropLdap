# Audit Log - AuthDrop

## Descrizione

Il sistema di Audit Log permette al **Super Amministratore** di monitorare tutte le azioni importanti eseguite dagli utenti nel sistema AuthDrop.

## Funzionalità

### Accesso al Audit Log

Solo l'utente con privilegi di **Super Admin** può visualizzare i log di audit:

1. Accedi all'**Admin Panel** (`/admin.html`)
2. Se sei Super Admin, vedrai la tab "📋 Audit Log"
3. Clicca sulla tab per visualizzare i log

### Azioni Registrate

Il sistema registra automaticamente le seguenti azioni:

#### Autenticazione
- **login** - Accesso utente al sistema
- **logout** - Uscita utente dal sistema

#### Gestione Utenti
- **create_user** - Nuovo utente creato da un admin
- **update_user** - Modifiche ai dati utente (nome, email, privilegi, password)
- **delete_user** - Rimozione utente dal sistema

#### Gestione Gruppi
- **create_group** - Nuovo gruppo creato
- **delete_group** - Rimozione gruppo dal sistema
- **add_user_to_group** - Utente aggiunto a un gruppo
- **remove_user_from_group** - Utente rimosso da un gruppo

#### Gestione Stanze
- **access_room** - Accesso a una stanza (pubblica o privata)
- **remove_room** - Rimozione di una stanza dalle preferenze utente

#### Gestione Dispositivi
- **pair_device** - Accoppiamento di un nuovo dispositivo
- **remove_device** - Rimozione dispositivo accoppiato

### Informazioni Registrate

Per ogni azione vengono salvate le seguenti informazioni:

- **Data e Ora** - Timestamp preciso dell'azione
- **Utente** - Chi ha eseguito l'azione
- **Azione** - Tipo di operazione eseguita
- **Risorsa** - Tipo di risorsa interessata (user, group, ecc.)
- **ID Risorsa** - Identificativo della risorsa modificata
- **Dettagli** - Descrizione dettagliata dell'azione
- **Indirizzo IP** - IP da cui è partita la richiesta
- **User Agent** - Browser/client utilizzato

### Navigazione e Paginazione

- I log sono visualizzati in ordine cronologico inverso (più recenti prima)
- Ogni pagina mostra fino a 50 log
- Usa i pulsanti "← Precedente" e "Successiva →" per navigare tra le pagine
- Il pulsante "🔄 Aggiorna" ricarica i log più recenti

## API Endpoint

### GET /api/audit-logs

Recupera i log di audit (solo Super Admin).

**Parametri Query:**
- `limit` (opzionale, default: 100) - Numero massimo di log da recuperare
- `offset` (opzionale, default: 0) - Offset per la paginazione

**Esempio:**
```
GET /api/audit-logs?limit=50&offset=0
```

**Risposta:**
```json
{
  "success": true,
  "logs": [
    {
      "id": 1,
      "user_id": 1,
      "username": "admin",
      "action": "login",
      "resource_type": null,
      "resource_id": null,
      "details": "Login effettuato con successo",
      "ip_address": "::1",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

## Database

### Tabella audit_logs

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id INTEGER,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
)
```

**Note:**
- `user_id` può essere NULL se l'utente viene eliminato (ON DELETE SET NULL)
- `username` viene sempre salvato per mantenere lo storico anche dopo eliminazione utente
- Gli indici vengono creati automaticamente su `user_id` e `created_at` per ottimizzare le query

## Metodi Database

### logAction(userId, username, action, resourceType, resourceId, details, ip, userAgent)

Registra una nuova azione nel log di audit.

**Parametri:**
- `userId` - ID dell'utente che esegue l'azione
- `username` - Username dell'utente
- `action` - Tipo di azione (es: 'login', 'create_user', ecc.)
- `resourceType` - Tipo di risorsa (es: 'user', 'group', null)
- `resourceId` - ID della risorsa (opzionale)
- `details` - Descrizione dettagliata
- `ip` - Indirizzo IP
- `userAgent` - User agent del client

### getAuditLogs(limit, offset)

Recupera i log di audit con paginazione.

**Parametri:**
- `limit` - Numero massimo di log (default: 100)
- `offset` - Offset per paginazione (default: 0)

### getAuditLogsByUser(userId, limit)

Recupera i log di audit per un utente specifico.

**Parametri:**
- `userId` - ID dell'utente
- `limit` - Numero massimo di log (default: 50)

## Sicurezza

- Solo gli utenti con `isSuperAdmin = true` possono accedere ai log di audit
- Le richieste non autenticate vengono rifiutate con errore 401
- Gli utenti non-super-admin ricevono errore 403
- I log non possono essere modificati o eliminati tramite API

## Note di Implementazione

- I log vengono scritti **dopo** l'esecuzione dell'azione, quindi eventuali errori nel logging non bloccano l'operazione principale
- L'indirizzo IP viene estratto da `x-forwarded-for` quando disponibile (utile dietro proxy/load balancer)
- Lo username viene salvato insieme allo user_id per mantenere lo storico anche se l'utente viene eliminato
