#!/bin/bash
# THE THING — servidor local para Mac/Linux (doble clic)
cd "$(dirname "$0")"
if ! command -v php >/dev/null 2>&1; then
  echo "No se encontró PHP. En Mac instálalo con Homebrew:  brew install php"
  read -r -p "Pulsa Enter para salir"
  exit 1
fi
echo "THE THING funcionando en http://localhost:8000  (Ctrl+C para apagar)"
echo "El PIN del panel aparece en data/ultimo-pin.php (aquí no se envían correos)."
( sleep 1; open "http://localhost:8000/?demo=0" 2>/dev/null || xdg-open "http://localhost:8000/?demo=0" ) &
php -S localhost:8000
