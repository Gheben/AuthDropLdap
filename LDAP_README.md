# AuthDrop - LDAP/Active Directory Integration

Integrazione completa LDAP/Active Directory per AuthDrop con import automatico utenti/gruppi e autenticazione centralizzata.

## 🚀 Funzionalità

- ✅ **Connessione LDAP/LDAPS** (porta 389/636)
- ✅ **Import automatico** utenti e gruppi da Active Directory
- ✅ **Sincronizzazione** manuale o automatica
- ✅ **Autenticazione LDAP** (login con credenziali AD)
- ✅ **Mapping gruppi** con gerarchia (gruppi padre/figlio)
- ✅ **Audit log** completo per operazioni LDAP
- ✅ **UI Admin** dedicata per gestione LDAP
- ✅ **Dry-run mode** per testare sincronizzazioni senza modifiche

## 📋 Prerequisiti

1. **Node.js** 16+ installato
2. **Active Directory** o server LDAP accessibile
3. **Credenziali bind** con permessi di lettura su AD
4. **Database** inizializzato (SQLite o PostgreSQL)

## 🔧 Installazione

### 1. Installare dipendenze

```bash
npm install ldapts
```

### 2. Eseguire migrazione database

Per SQLite (test):
```bash
$env:DB_TYPE='sqlite'; node migrate-ldap.js
```

Per PostgreSQL (produzione):
```bash
$env:DB_TYPE='postgres'; node migrate-ldap.js
```

### 3. Configurare .env

Copia `.env.example` in `.env` e configura i parametri LDAP:

```env
# LDAP Configuration
LDAP_ENABLED=true
LDAP_URL=ldaps://dc.example.com:636
LDAP_BIND_DN=CN=ServiceAccount,OU=Service Accounts,DC=example,DC=com
LDAP_BIND_PASSWORD=YourSecurePassword

# Search Base
LDAP_USER_BASE_DN=OU=Users,DC=example,DC=com
LDAP_GROUP_BASE_DN=OU=Groups,DC=example,DC=com

# Filters (optional)
LDAP_USER_FILTER=(&(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))
LDAP_GROUP_FILTER=(objectClass=group)

# Auto Sync
LDAP_AUTO_SYNC=false
LDAP_SYNC_INTERVAL=3600000

# TLS Options (per LDAPS)
LDAP_TLS_REJECT_UNAUTHORIZED=false
```

## 🎯 Configurazione Active Directory

### Parametri comuni

**Per Active Directory aziendale:**
```env
LDAP_URL=ldaps://dc01.company.com:636
LDAP_BIND_DN=CN=LDAP Reader,OU=Service Accounts,DC=company,DC=com
LDAP_USER_BASE_DN=OU=Employees,DC=company,DC=com
LDAP_GROUP_BASE_DN=OU=Security Groups,DC=company,DC=com
```

**Per test locale (senza TLS):**
```env
LDAP_URL=ldap://localhost:389
LDAP_TLS_REJECT_UNAUTHORIZED=false
```

### Filtri utenti consigliati

Solo utenti attivi:
```env
LDAP_USER_FILTER=(&(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))
```

Solo utenti di un gruppo specifico:
```env
LDAP_USER_FILTER=(&(objectClass=user)(memberOf=CN=VPN Users,OU=Groups,DC=example,DC=com))
```

## 📚 Utilizzo

### UI Admin (consigliato)

1. Login come **Super Admin**
2. Vai al tab **LDAP** nel pannello admin
3. Clicca **Test Connessione** per verificare
4. Usa **Anteprima Utenti/Gruppi** per vedere cosa verrà importato
5. Esegui **Sync (Dry Run)** per testare senza modifiche
6. Esegui **Sincronizza Ora** per importare

### API Endpoints

Tutti gli endpoint richiedono autenticazione **Super Admin**.

**Test connessione:**
```bash
POST /api/ldap/test
```

**Anteprima utenti:**
```bash
GET /api/ldap/preview/users
```

**Anteprima gruppi:**
```bash
GET /api/ldap/preview/groups
```

**Sincronizzazione:**
```bash
POST /api/ldap/sync
{
  "dryRun": true
}
```

**Storico sync:**
```bash
GET /api/ldap/sync/history
```

**Statistiche:**
```bash
GET /api/ldap/stats
```

## 🔐 Autenticazione LDAP

Quando `LDAP_ENABLED=true`, il login funziona così:

1. **Tentativo LDAP**: Se l'utente esiste in AD, autentica con LDAP
2. **Creazione automatica**: Se l'utente LDAP non esiste localmente, viene creato
3. **Fallback locale**: Se LDAP fallisce, prova autenticazione database locale
4. **Aggiornamento dati**: Ad ogni login LDAP, i dati utente vengono aggiornati

## 📊 Mapping Campi

### Utenti LDAP → Database

| LDAP Attribute | Database Column | Note |
|----------------|-----------------|------|
| `sAMAccountName` | `username` | Username principale |
| `displayName` | `display_name` | Nome visualizzato |
| `mail` | `email` | Email |
| `distinguishedName` | `ldap_dn` | DN completo |
| `objectGUID` | `ldap_guid` | GUID univoco |
| - | `is_ldap_user` | Flag LDAP (true) |
| - | `ldap_synced_at` | Timestamp sync |

### Gruppi LDAP → Database

| LDAP Attribute | Database Column | Note |
|----------------|-----------------|------|
| `cn` | `name` | Nome gruppo |
| `description` | `description` | Descrizione |
| `distinguishedName` | `ldap_dn` | DN completo |
| `objectGUID` | `ldap_guid` | GUID univoco |
| - | `is_ldap_group` | Flag LDAP (true) |
| `memberOf` | `parent_group_id` | Gerarchia gruppi |

## 🔍 Troubleshooting

### Errore: ECONNREFUSED

**Problema**: Non riesce a connettersi al server LDAP.

**Soluzione**:
- Verifica che `LDAP_URL` sia corretto
- Controlla che la porta (389/636) sia raggiungibile
- Per LDAPS, usa porta 636 e protocollo `ldaps://`

### Errore: Invalid credentials

**Problema**: Credenziali bind non valide.

**Soluzione**:
- Verifica `LDAP_BIND_DN` e `LDAP_BIND_PASSWORD`
- Il DN deve essere completo: `CN=User,OU=...,DC=...`
- Testa le credenziali con `ldapsearch` o AD Explorer

### Errore: Certificate validation failed

**Problema**: Certificato TLS non valido.

**Soluzione**:
- Per test: `LDAP_TLS_REJECT_UNAUTHORIZED=false`
- Per produzione: importa il certificato CA nella trust store

### Nessun utente trovato

**Problema**: La query non restituisce utenti.

**Soluzione**:
- Verifica `LDAP_USER_BASE_DN`
- Controlla il filtro `LDAP_USER_FILTER`
- Usa `LDAP_USER_FILTER=(objectClass=user)` come test base

## 📝 File creati/modificati

```
server/
├── ldap-connector.js      # Connettore LDAP/LDAPS
├── ldap-sync.js          # Logica sincronizzazione
├── ldap-routes.js        # API routes LDAP
├── api-routes.js         # Modificato: autenticazione LDAP
└── server.js             # Modificato: integrazione routes

public/
└── admin.html            # Modificato: tab LDAP UI

migrate-ldap.js           # Script migrazione database
.env.example             # Template configurazione LDAP
LDAP_README.md           # Questa documentazione
```

## 🎓 Best Practices

1. **Testa sempre con dry-run** prima di sincronizzare
2. **Usa LDAPS** (porta 636) in produzione per sicurezza
3. **Limita i permessi** dell'account bind al solo READ su AD
4. **Monitora i log** di sincronizzazione per errori
5. **Backup database** prima di sincronizzazioni massive
6. **Disabilita auto-sync** in test (`LDAP_AUTO_SYNC=false`)

## 🔄 Sincronizzazione Automatica

Per abilitare la sincronizzazione automatica:

```env
LDAP_AUTO_SYNC=true
LDAP_SYNC_INTERVAL=3600000  # 1 ora in millisecondi
```

**Nota**: In produzione, considera invece un cron job per maggior controllo.

## 📦 Database Schema

### Tabella `ldap_sync_logs`

Traccia tutte le sincronizzazioni:

```sql
CREATE TABLE ldap_sync_logs (
  id INTEGER PRIMARY KEY,
  sync_type TEXT NOT NULL,           -- 'full' o 'dry-run'
  status TEXT NOT NULL,               -- 'success' o 'error'
  users_added INTEGER DEFAULT 0,
  users_updated INTEGER DEFAULT 0,
  users_disabled INTEGER DEFAULT 0,
  groups_added INTEGER DEFAULT 0,
  groups_updated INTEGER DEFAULT 0,
  errors TEXT,
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  started_by_user_id INTEGER
);
```

## 🚀 Deploy in Produzione

1. **Configura PostgreSQL**:
   ```env
   DB_TYPE=postgres
   DB_HOST=your-postgres-server
   DB_NAME=authdrop
   DB_USER=authdrop
   DB_PASSWORD=SecurePassword
   ```

2. **Esegui migrazione**:
   ```bash
   node migrate-ldap.js
   ```

3. **Configura LDAP con LDAPS**:
   ```env
   LDAP_ENABLED=true
   LDAP_URL=ldaps://dc.company.com:636
   LDAP_TLS_REJECT_UNAUTHORIZED=true
   ```

4. **Testa connessione** tramite UI Admin

5. **Prima sincronizzazione**:
   - Dry-run per verificare
   - Sync completo per importare

## 📞 Supporto

Per problemi o domande sull'integrazione LDAP:

1. Controlla i log del server (`npm start`)
2. Verifica configurazione `.env`
3. Testa connessione LDAP con strumenti esterni (AD Explorer, ldapsearch)
4. Controlla audit log nel pannello admin

## 📜 Licenza

Parte del progetto AuthDrop - Tutti i diritti riservati
