from PIL import Image
import os

# Percorso del logo originale
logo_path = "logo_gb.ico"

# Converti in vari formati PNG
sizes = {
    "public/images/favicon-96x96.png": (96, 96),
    "public/images/favicon-96x96-notification.png": (96, 96),
    "public/images/apple-touch-icon.png": (180, 180),
    "public/images/android-chrome-192x192.png": (192, 192),
    "public/images/android-chrome-192x192-maskable.png": (192, 192),
    "public/images/android-chrome-512x512.png": (512, 512),
    "public/images/android-chrome-512x512-maskable.png": (512, 512),
    "public/images/logo_blue_512x512.png": (512, 512),
    "public/images/mstile-150x150.png": (150, 150),
}

try:
    # Apri il logo ICO
    img = Image.open(logo_path)
    
    # Se l'ICO ha trasparenza, usa RGBA
    if img.mode in ('RGBA', 'LA'):
        img = img.convert('RGBA')
    else:
        img = img.convert('RGB')
    
    # Crea ogni dimensione
    for output_path, size in sizes.items():
        # Ridimensiona mantenendo aspect ratio
        resized = img.resize(size, Image.Resampling.LANCZOS)
        
        # Crea directory se non esiste
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Salva PNG
        resized.save(output_path, 'PNG')
        print(f"✓ Creato: {output_path}")
    
    print("\nTutti i loghi sono stati convertiti con successo!")
    
except FileNotFoundError:
    print(f"Errore: File {logo_path} non trovato!")
except Exception as e:
    print(f"Errore durante la conversione: {e}")
