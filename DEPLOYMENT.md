# Deployment su Synology NAS

## Prerequisiti
- Synology NAS con Docker installato
- Container Manager attivato
- Accesso SSH o File Station

## Opzione 1: Deploy con Docker Compose (Consigliato)

### Passo 1: Trasferisci i file su Synology

Via **File Station**:
1. Connettiti a `\\[IP-NAS]\docker`
2. Crea una cartella: `authdrop`
3. Copia tutti i file del progetto qui

Oppure via **SCP** (SSH):
```bash
scp -r C:\Users\gballari\Documents\vscode\progetti\gbdrop/* admin@[IP-NAS]:/volume1/docker/authdrop/
```

### Passo 2: Su Synology - Via SSH

```bash
# Connettiti al NAS
ssh admin@[IP-NAS]

# Naviga alla cartella
cd /volume1/docker/authdrop

# Avvia con Docker Compose
sudo docker-compose up -d
```

### Passo 3: Verifica che funziona

```bash
# Controlla i log
sudo docker-compose logs -f authdrop

# Accedi all'app
# http://[IP-NAS]:3441
```

## Opzione 2: Via Container Manager (UI Synology)

### Passo 1: Carica i file

1. Vai a **File Station** → `/volume1/docker/authdrop/`
2. Copia tutti i file del progetto

### Passo 2: Apri Container Manager

1. **Container Manager** → **Progetto**
2. **Crea** → Seleziona `/volume1/docker/authdrop/`
3. Click su **Salva**
4. **Avvia** il progetto

L'app sarà disponibile su `http://[IP-NAS]:3441`

## Opzione 3: Build e run manuale

```bash
# Build dell'immagine
sudo docker build -t authdrop:latest /volume1/docker/authdrop/

# Avvia il container
sudo docker run -d \
  --name authdrop \
  --restart unless-stopped \
  -p 3441:3441 \
  -v /volume1/docker/authdrop/data:/home/node/app \
  authdrop:latest

# Visualizza i log
sudo docker logs -f authdrop
```

## Gestione del Database

Il database SQLite è persistente grazie al volume:
```yaml
volumes:
  - /volume1/docker/authdrop/data:/home/node/app
```

I dati rimangono anche se riavvii il container.

### Backup del database

```bash
# Su Synology
cp /volume1/docker/authdrop/data/authdrop.db /volume1/docker/authdrop/backup/authdrop.db.backup
```

## Troubleshooting

### Container non si avvia
```bash
sudo docker-compose logs authdrop
```

### Porta già in uso
Cambia la porta in `docker-compose.yml`:
```yaml
ports:
  - "3442:3441"  # Usa 3442 invece di 3441
```

### Errori di permessi
```bash
sudo chown -R admin:admin /volume1/docker/authdrop/
```

## Aggiornamenti futuri

Quando fai nuove release:

```bash
# Su Windows
git add .; git commit -m "..."; git push

# Su Synology
cd /volume1/docker/authdrop
git pull origin master
sudo docker-compose up -d --build
```

## Note

- Il Dockerfile copia i file locali (non clona dal git)
- Il database viene salvato nel volume `/volume1/docker/authdrop/data`
- L'app è protetta da password admin e token JWT
- Logs disponibili via `docker-compose logs`
