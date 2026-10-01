# THE THING — Sitio web del estudio

Sitio web oficial de **THE THING**, estudio independiente de videojuegos.
Estética retro: pantalla CRT, cintas VHS, menús de videojuego y pixel art.

- **Portada** (`index.html`): pantalla de arranque tipo BIOS, logo con glitch,
  cinta de titulares, juegos/apps (cartuchos), noticias (cintas VHS), datos
  (marcador arcade "High scores"), galería (polaroids con visor), ficha del
  estudio y sección de contacto.
- **Panel de administración** (`admin.html`): inicio de sesión para los dueños.
  Permite publicar, editar y borrar **juegos/aplicaciones, noticias, datos e
  imágenes**, con subida de imágenes por arrastrar y soltar.

No necesita base de datos ni instalar nada: es **HTML + CSS + JavaScript + PHP**,
y funciona en cualquier hosting compartido con PHP 7.4 o superior (Hostinger incluido).

---

## Instalación en Hostinger

1. Entra en **hPanel → Sitios web → Administrar → Administrador de archivos**.
2. Abre la carpeta **`public_html`** (bórrale el `default.php` si lo tiene).
3. Sube **todo el contenido** de este repositorio dentro de `public_html`
   (puedes subir un `.zip` y usar *Extraer*). Debe quedar así:

   ```
   public_html/
   ├── index.html
   ├── admin.html
   ├── 404.html
   ├── .htaccess
   ├── api/
   ├── assets/
   ├── data/       ← aquí se guarda el contenido (protegida)
   └── uploads/    ← aquí se guardan las imágenes subidas
   ```

   > También puedes usar **hPanel → Avanzado → Git** para desplegar este
   > repositorio directamente en `public_html`.

4. Verifica que las carpetas `data` y `uploads` tengan permisos **755**
   (clic derecho → Permisos). PHP debe poder escribir en ellas.
5. **Inmediatamente después de subirlo**, abre `https://tudominio.com/admin.html`.
   La primera vez te pedirá **crear la contraseña** de `admin@thethinggame.com`.
   Solo se puede hacer una vez; a partir de ahí, se entra con correo + contraseña.
6. Activa el SSL gratis en hPanel y, cuando funcione, descomenta las líneas de
   "Fuerza HTTPS" al final del archivo `.htaccess`.

¡Listo! Desde el panel ya puedes publicar contenido.

### ¿Olvidaste la contraseña?

Con el Administrador de archivos, abre `data/db.php`, busca `"password": "…"`
dentro de `"admin"` y deja el valor vacío: `"password": ""`. Guarda y vuelve a
entrar en `admin.html`: te pedirá crear una contraseña nueva.

---

## Cómo usar el panel

| Sección         | Qué publica                                    | Dónde aparece en la portada           |
|-----------------|------------------------------------------------|---------------------------------------|
| Juegos / apps   | Nombre, descripción, imagen, plataforma, estado, enlace de descarga | "Selecciona tu juego". El destacado sale grande |
| Noticias        | Titular, entradilla, cuerpo, imagen, enlace    | "Noticias" y la cinta roja de titulares |
| Datos           | Etiqueta + valor (ej. "Jugadores" → 12500)     | Marcador "High scores" (los números se animan) |
| Galería         | Imagen + título + descripción                  | "Galería" con visor a pantalla completa |
| Cuenta          | Cambiar contraseña                             | —                                     |

En el cuerpo de noticias y juegos puedes usar: línea en blanco = nuevo párrafo,
`**negrita**`, `*cursiva*` y `[texto](https://enlace.com)`.

---

## Configuración

Edita `api/config.php`:

```php
const ADMIN_EMAIL = 'admin@thethinggame.com'; // correo del dueño
const SESSION_HOURS = 12;                     // horas antes de cerrar sesión
const MAX_UPLOAD_MB = 8;                      // tamaño máximo por imagen
```

El correo de contacto de la portada (`contacto@thethinggame.com`) está en
`index.html`, sección `id="contacto"`; cámbialo por el que uséis.

---

## Seguridad

- Contraseña guardada con `password_hash` (bcrypt), nunca en texto plano.
- Sesión con cookie `HttpOnly` + `SameSite=Strict`; bloqueo de 5 minutos tras
  5 intentos fallidos de inicio de sesión.
- La API rechaza peticiones de otros dominios (protección CSRF).
- `data/db.php` empieza con `exit`, así que no se puede leer desde el navegador,
  y `data/.htaccess` bloquea la carpeta.
- Las imágenes se validan por su contenido real (PNG, JPG, GIF, WEBP, AVIF),
  se renombran al azar y en `uploads/` no se puede ejecutar código.
- Todo el texto publicado se escapa antes de mostrarse (sin inyección de HTML).

## Copia de seguridad

Todo el contenido está en `data/db.php` y las imágenes en `uploads/`.
Descarga esas dos carpetas de vez en cuando.

## Probar en tu computadora

Con PHP instalado, desde la carpeta del proyecto:

```bash
php -S localhost:8080
```

y abre <http://localhost:8080>.

## Extras

- Botones de la barra: activar/desactivar efecto CRT y sonidos 8 bits.
- Respeta "reducir movimiento" del sistema operativo.
- Prueba el código Konami en la portada: ↑ ↑ ↓ ↓ ← → ← → B A
