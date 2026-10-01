@echo off
title THE THING - servidor local
cd /d "%~dp0"
set "PHPEXE="
where php >nul 2>nul && set "PHPEXE=php"
if not defined PHPEXE if exist "C:\xampp\php\php.exe" set "PHPEXE=C:\xampp\php\php.exe"
if not defined PHPEXE if exist "C:\php\php.exe" set "PHPEXE=C:\php\php.exe"
if not defined PHPEXE (
  echo.
  echo  No se encontro PHP en esta computadora.
  echo  Instala XAMPP desde https://www.apachefriends.org y vuelve a abrir este archivo.
  echo.
  pause
  exit /b 1
)
echo.
echo  THE THING funcionando en http://localhost:8000
echo  Cierra esta ventana para apagar el servidor.
echo  El PIN del panel aparece en data\ultimo-pin.php (aqui no se envian correos).
echo.
start "" "http://localhost:8000/?demo=0"
"%PHPEXE%" -S localhost:8000
