# Script di lancio GBDrop con nome utente Windows automatico
# Apre il browser predefinito con il parametro username già impostato

# Ottieni il nome utente Windows
$username = $env:USERNAME

# URL del server GBDrop (modifica se necessario)
$gbdropUrl = "http://localhost:3000"

# URL completo con parametro username
$fullUrl = "${gbdropUrl}?username=${username}"

Write-Host "Apertura GBDrop con username: $username" -ForegroundColor Green
Write-Host "URL: $fullUrl" -ForegroundColor Cyan

# Apri il browser predefinito
Start-Process $fullUrl

Write-Host "`nGBDrop aperto! Il tuo nome utente è stato impostato automaticamente." -ForegroundColor Green
Write-Host "Premi un tasto per chiudere..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
