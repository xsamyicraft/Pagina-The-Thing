# THE THING — Sitio web del estudio

Sitio web oficial de **THE THING**, estudio independiente de videojuegos.
Estética retro: pantalla CRT, cintas VHS, menús de videojuego y pixel art.

- **Portada** (`index.html`): pantalla de arranque tipo BIOS, logo con glitch,
  cinta de titulares, juegos/apps (cartuchos), noticias (cintas VHS), datos
  (marcador arcade "High scores"), galería (polaroids con visor), ficha del
  estudio y sección de contacto.
- **Tienda** (`tienda.html`): página propia de merch a la que se entra desde el
  botón de la portada o el menú.
- **Videoclub**: estante de madera con los lomos de los cassettes; al elegir uno
  sale del estante, entra en el vídeo VHS y se ve en un televisor CRT de los 80.
  Los vídeos de YouTube solo se reproducen con la web en un servidor (Hostinger o
  `probar-con-php`); abierta como archivo, YouTube lo bloquea y se ofrece un botón
  "Ver en YouTube".
- **Gato del logo animado**: la cabeza queda fija, las patitas se mueven (y
  "aporrean" si haces clic) y dos pupilas blancas con glitch siguen al ratón.
- **Jugadores registrados**: cualquiera puede crear su cuenta para
  - **votar** el *mejor juego* y el *más jugado* (un voto por categoría, se puede cambiar),
  - dejar **reseñas con estrellas** en los juegos y **comentarios** en las noticias,
    mostrados como "códigos retro" (estilo Game Genie),
  - recibir **avisos**: campana en la web, avisos del navegador y, si lo pide, correo.
- **Panel de administración** (`admin.html`): inicio de sesión para los dueños.
  Permite publicar, editar y borrar **juegos/aplicaciones, noticias, datos e
  imágenes**, con subida de imágenes por arrastrar y soltar, y además:
  - **Estadísticas**: ganancias, impresiones, eCPM y usuarios activos de
    **Unity LevelPlay**, gráfica de ganancias por día, descargas por juego,
    valoraciones y votos.
  - **Comunidad**: lista de jugadores, moderación de reseñas y envío de avisos.

No necesita base de datos ni instalar nada: es **HTML + CSS + JavaScript + PHP**,
y funciona en cualquier hosting compartido con PHP 7.4 o superior (Hostinger incluido).

---

## Probar sin servidor (modo demo)

Puedes probar **todo** sin subir nada:

1. Descarga el `.zip` y **descomprímelo** en una carpeta de tu computadora
   (no lo abras desde dentro del zip).
2. Haz **doble clic en `index.html`**. Se abre en tu navegador en *modo demo*
   (verás el aviso "MODO DEMO" abajo a la izquierda).
3. Prueba como jugador: *Nuevo jugador* → crea una cuenta (inventada), vota,
   deja reseñas y mira la campana de avisos.
4. Prueba como dueño: abajo del todo, *[ ACCESO STAFF ]* → la primera vez crea
   una contraseña cualquiera. Publica noticias/juegos con imágenes, mira
   *Estadísticas* (escribe cualquier texto en las claves de LevelPlay para ver
   datos **simulados**) y *Comunidad*.

Los números de LevelPlay y Google Play que ves en la demo son **de ejemplo**:
el navegador no deja leer sus APIs sin servidor. Para ver tus datos reales sin
subir nada, usa el servidor local de abajo.

### Probar con PHP en tu computadora (datos reales)

- **Windows**: instala [XAMPP](https://www.apachefriends.org) y haz doble clic en
  `probar-con-php.bat`.
- **Mac**: instala PHP (`brew install php`) y haz doble clic en `probar-con-php.command`.

Se abre `http://localhost:8000` con la web funcionando de verdad (LevelPlay y
Google Play reales). Como en tu computadora no se envían correos, el **PIN del
panel** está en el archivo `data/ultimo-pin.php` (ábrelo con el Bloc de notas).

En el modo demo todo se guarda solo en **ese navegador** (nadie más lo ve) y el
botón *Reiniciar demo* lo borra. Los correos no se envían de verdad. En el
servidor real el modo demo no se activa (salvo que añadas `?demo=1` a la
dirección, útil para enseñar la web sin tocar los datos reales).

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
5. Abre `https://tudominio.com/api/check.php`. Debe mostrar `"todo_ok": true`.
   Si algo sale en `false`, corrige eso primero (versión de PHP o permisos).
6. **Inmediatamente después**, abre `https://tudominio.com/admin.html`.
   La primera vez te pedirá **crear la contraseña** de `admin@thethinggame.com`.
   Solo se puede hacer una vez; a partir de ahí, se entra con correo + contraseña.
7. Activa el SSL gratis en hPanel y, cuando funcione, descomenta las líneas de
   "Fuerza HTTPS" al final del archivo `.htaccess`.

¡Listo! Desde el panel ya puedes publicar contenido.

### "No se pudo contactar con api/auth.php"

Ese mensaje sale cuando el panel no encuentra el PHP. El propio panel ahora
explica la causa, pero las más comunes son:

- **Abriste `admin.html` desde tu computadora** (doble clic, la dirección empieza
  por `file://`). El panel solo funciona en el servidor: entra por
  `https://tudominio.com/admin.html`.
- **Faltan carpetas en el servidor**: hay que subir *todo* (`api`, `assets`,
  `data`, `uploads` y los `.html`) dentro de `public_html`, no dentro de una
  subcarpeta.
- **PHP o permisos**: abre `api/check.php` y revisa qué sale en `false`.

### Acceso del staff con PIN por correo

Entrar al panel tiene dos pasos: correo + contraseña y, después, un **PIN de 6
dígitos** que llega a `admin@thethinggame.com` (caduca en 10 minutos, 5 intentos).
Si alguien escribe ese correo con una contraseña equivocada, te llega una
**alerta de seguridad** por correo.

- Si el correo no llega, el PIN también queda en `data/ultimo-pin.php` (ábrelo
  con el Administrador de archivos de Hostinger).
- Emergencia: pon `const ADMIN_2FA = false;` en `api/config.php` para entrar
  solo con contraseña (y vuelve a ponerlo en `true` después).

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
| Estadísticas    | Ganancias LevelPlay, descargas, valoraciones, votos | — (solo administradores)          |
| Comunidad       | Jugadores, reseñas (borrar), avisos            | Campana de avisos de los jugadores    |
| Vídeos          | Enlace de YouTube/Vimeo o MP4                  | Cassettes VHS que se meten en una tele vieja |
| Tienda          | Producto, precio, moneda, tallas, enlace de compra | Tienda de merch (sin enlace → pedido por correo) |
| Cuenta          | Cambiar contraseña                             | —                                     |

Al publicar un juego, noticia o imagen, deja marcada la casilla **"Avisar a los
jugadores registrados"** para que les llegue el aviso (campana + correo a quien
lo pidió).

---

## Estadísticas: LevelPlay y descargas

**Ganancias (Unity LevelPlay / ironSource).** El panel usa la API de reportes de
LevelPlay:

1. En LevelPlay entra en tu perfil → **My Account** → **API** y copia la
   **Secret Key** y el **Refresh Token**.
2. En el panel: **Estadísticas → Conexión con Unity LevelPlay**, pégalos y pulsa
   **Guardar y probar**. Se guardan solo en el servidor.
3. Para ver las ganancias de cada juego, edita el juego y escribe su
   **App Key de LevelPlay**. Las apps aún sin enlazar aparecen listadas en
   Estadísticas con su App Key para copiarla.

Los datos se guardan en caché 30 minutos (la API de LevelPlay limita las
consultas); el botón **↻ Actualizar** fuerza una nueva descarga. Las cifras
son en dólares (USD), como las reporta LevelPlay.

**Descargas (automáticas con Google Play).** LevelPlay no da descargas; las
leemos de los informes oficiales de Google Play Console:

1. En **Google Cloud Console** crea un proyecto → *IAM → Cuentas de servicio* →
   crea una y descarga una **clave JSON**.
2. En **Play Console → Usuarios y permisos** invita el correo de esa cuenta con el
   permiso *"Ver información de la app y descargar informes masivos"* (puede
   tardar hasta 24 h en activarse).
3. En **Play Console → Descargar informes → Estadísticas** pulsa *"Copiar URI de
   Cloud Storage"* (`gs://pubsite_prod_rev_…`).
4. En el panel: **Estadísticas → Conexión con Google Play**, pega el JSON y el URI.
5. En cada juego escribe su **paquete de Google Play** (`com.estudio.juego`) y pulsa
   *Obtener* para comprobarlo.

Se muestran las instalaciones totales (*Total User Installs*) y las de los
últimos 30 días; se actualizan cada 6 horas o con *↻ Actualizar*. Las descargas
de otras tiendas (App Store, itch.io…) se pueden sumar a mano en cada juego.

En **Estadísticas** puedes ver la vista **General** (todas las apps) o elegir
cada aplicación por separado; la tabla final tiene una fila de **TOTAL**. Si los
números de LevelPlay no te cuadran, pulsa *"Ver respuesta de LevelPlay"* y
envíanos lo que aparece para ajustarlo.

## Correos de avisos

Los jugadores que marcan "recibir por correo" reciben un email cuando publicas
con aviso. Para que no lleguen a spam:

1. En hPanel → **Correos**, crea la cuenta `no-reply@thethinggame.com` (o la que
   prefieras) y pon esa dirección en `MAIL_FROM` dentro de `api/config.php`.
2. Cada correo incluye un enlace para darse de baja.

Hostinger limita los envíos por día en los planes compartidos; para listas muy
grandes conviene un servicio de email masivo.

En el cuerpo de noticias y juegos puedes usar: línea en blanco = nuevo párrafo,
`**negrita**`, `*cursiva*` y `[texto](https://enlace.com)`.

---

## Configuración

Edita `api/config.php`:

```php
const ADMIN_EMAIL = 'admin@thethinggame.com'; // correo del dueño
const SESSION_HOURS = 12;                     // horas antes de cerrar sesión
const MAX_UPLOAD_MB = 8;                      // tamaño máximo por imagen
const MEMBER_SESSION_DAYS = 30;               // días que un jugador sigue conectado
const MAIL_FROM = 'no-reply@thethinggame.com';// remitente de los avisos por correo
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
- Las claves de LevelPlay, las descargas y los correos de los jugadores nunca se
  envían a la parte pública de la web.
- Registro y comentarios con límite de frecuencia y trampa anti-bots.

## Copia de seguridad

Todo el contenido (juegos, noticias, jugadores, reseñas, votos y avisos) está en
`data/db.php` y las imágenes en `uploads/`.
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
