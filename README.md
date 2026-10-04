# THE THING — Sitio web del estudio

Sitio web oficial de **THE THING**, estudio independiente de videojuegos.
Estética retro: pantalla CRT, cintas VHS, menús de videojuego y pixel art.

Cada sección tiene **su propia página**, con la misma cabecera (menús
desplegables JUEGOS / SOPORTE) y el mismo pie de página (redes sociales, juegos
populares, compañía, soporte y legal, botón **Volver arriba**):

| Página | Qué tiene |
|---|---|
| `index.html` | Pantalla de arranque BIOS y **portada con canales de TV**: el gato animado y, en cada canal, un destacado con su imagen (juego, noticia, vídeo, producto) que cambia solo cada 8 s con interferencia de tele. Debajo: cinta de titulares, juegos con imagen, últimas noticias, videoclub con cajas VHS, merch, fotos, datos y ¿Continuar? con tus redes |
| `juegos.html` | Todos los juegos (filtro Todos / Disponibles / En camino), fichas con reseñas y **votaciones** |
| `noticias.html` | Noticias en tarjetas con fecha, título y **LEER MÁS**, con **pestañas por juego** |
| `videos.html` | Videoclub: estante de cassettes, vídeo VHS y tele CRT |
| `galeria.html` | Galería con visor |
| `tienda.html` | Merch (sin cuenta) con botón de arrepentimiento |
| `soporte.html` | Centro de ayuda: buscador de preguntas frecuentes, formulario con **código de seguimiento** y "Seguir mi consulta" |
| `terminos.html`, `privacidad.html`, `cookies.html`, `aviso-legal.html`, `normas.html` | Textos legales y normas de la comunidad |

- **Videoclub**: al tocar un cassette sale del estante hacia ti, pega un
  **chispazo** y se reproduce al instante en la tele (no le afecta hacer scroll).
  YouTube (modo privacidad `youtube-nocookie`) y Vimeo solo se cargan si el
  visitante acepta los vídeos de terceros en el aviso de cookies.
- **Gato del logo animado**: la cabeza queda fija, las patitas se mueven (y
  "aporrean" si haces clic) y dos pupilas blancas con glitch siguen al ratón.
- **Minijuego anti-robots (captcha)**: para crear cuenta, iniciar sesión o
  escribir a soporte hay que superar un nivel arcade ("TOCA TODAS LAS MONEDAS",
  3 vidas, tiempo límite). La imagen la dibuja el servidor y la solución nunca
  llega al navegador.
- **Jugadores registrados**: cualquiera puede crear su cuenta para
  - **votar** el *mejor juego* y el *más jugado* (un voto por categoría, se puede cambiar),
  - dejar **reseñas con estrellas** en los juegos y **comentarios** en las noticias,
    mostrados como "códigos retro" (estilo Game Genie),
  - recibir **avisos**: campana en la web, avisos del navegador y, si lo pide, correo,
  - **denunciar** comentarios, **descargar sus datos** y **borrar su cuenta** desde *Mi cuenta*.
- **Panel de administración** (`admin.html`): inicio de sesión para los dueños.
  Permite publicar, editar y borrar **juegos/aplicaciones, noticias, datos e
  imágenes**, con subida de imágenes por arrastrar y soltar, y además:
  - **Estadísticas**: ganancias, impresiones, eCPM y usuarios activos de
    **Unity LevelPlay**, gráfica de ganancias por día, descargas por juego,
    valoraciones y votos.
  - **Comunidad**: lista de jugadores, moderación de reseñas, comentarios
    denunciados y envío de avisos.
  - **Soporte**: consultas de los visitantes; respondes desde el panel y la
    respuesta les llega por correo.
  - **Empresa y legal**: datos del titular y redes sociales, que rellenan solos
    las páginas legales y el pie.

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
   ├── index.html, juegos.html, noticias.html, videos.html, galeria.html
   ├── tienda.html, soporte.html, terminos.html, privacidad.html, cookies.html
   ├── aviso-legal.html, normas.html, admin.html, 404.html
   ├── robots.txt, sitemap.xml
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
7. El `.htaccess` ya obliga a usar **HTTPS** (tu SSL de Hostinger está activo).
8. En el panel, abre **Empresa y legal** y completa los datos del titular
   (razón social, identificación fiscal, domicilio, país y tribunales) y tus
   redes sociales. Hasta que lo hagas, las páginas legales muestran avisos en
   naranja como `[RAZÓN SOCIAL]`.

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

### El staff también es jugador en la web

Al entrar al panel quedas conectado en la web pública como **THE THING** (con
la insignia ★ STAFF en tus reseñas y comentarios). También puedes entrar desde
el botón **Entrar** de la web con `admin@thethinggame.com`: pide tu contraseña
del panel, el minijuego y el PIN. Cerrar sesión en la web cierra también el
panel (y al revés).

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
| Noticias        | Titular, **juego relacionado**, entradilla, cuerpo, imagen, enlace | Página Noticias (pestaña de ese juego), portada y cinta de titulares |
| Datos           | Etiqueta + valor (ej. "Jugadores" → 12500)     | Marcador "High scores" (los números se animan) |
| Galería         | Imagen + título + descripción                  | "Galería" con visor a pantalla completa |
| Estadísticas    | Ganancias LevelPlay, descargas, valoraciones, votos | — (solo administradores)          |
| Comunidad       | Jugadores, reseñas (borrar), avisos            | Campana de avisos de los jugadores    |
| Vídeos          | Enlace de YouTube/Vimeo o MP4                  | Cassettes VHS que se meten en una tele vieja |
| Tienda          | Producto, precio, moneda, tallas, enlace de compra | Tienda de merch (sin enlace → pedido por correo) |
| Soporte         | Responder, cerrar, reabrir o borrar consultas  | La respuesta llega por correo con su código |
| Redes sociales  | YouTube, TikTok, Instagram, X, Discord, Facebook, Twitch, Google Play, Steam, itch.io (enlace o @usuario) | Portada, bloque «Únete» y pie de todas las páginas |
| Empresa y legal | Datos del titular y correos públicos           | Páginas legales y pie de página       |
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

Los correos públicos (contacto, soporte, privacidad) se cambian desde el panel,
en **Empresa y legal**. Los avisos de nuevas consultas de soporte llegan a
`ADMIN_EMAIL`.

---

## Legal, cookies y privacidad

- **Páginas legales**: Términos y condiciones (con condiciones de compra y
  derecho de arrepentimiento), Política de privacidad, Política de cookies,
  Aviso legal y Normas de la comunidad. Según el **país** elegido en *Empresa y
  legal* se muestran los párrafos que corresponden (Argentina: Ley 24.240, Ley
  25.326 y leyenda de la AAIP, enlace de Defensa del Consumidor en el pie;
  España: plazo de 14 días y AEPD; México: PROFECO; otros: texto general).
- **Son una plantilla**: revísalos con un abogado de tu país antes de vender o
  si la web crece. Nadie puede garantizar que una web quede libre de
  cualquier reclamación.
- **Cookies**: solo hay cookies técnicas (sesión y anti-robots). Los vídeos de
  YouTube/Vimeo se bloquean hasta que el visitante los acepta; "Aceptar" y
  "Solo necesarias" tienen el mismo peso, la elección se puede cambiar desde
  el pie y se vuelve a pedir a los 12 meses.
- **Fuentes propias**: las tipografías se sirven desde `assets/fonts` (no se
  envía la IP de los visitantes a Google Fonts).
- **Registro**: hay que aceptar Términos y Privacidad y declarar la edad mínima
  (13 por defecto, configurable). Se guarda la fecha y la versión aceptada.
  El correo de novedades es opcional y viene desmarcado.
- **Derechos de los jugadores**: *Mi cuenta → Privacidad y mis datos* permite
  descargar todos sus datos (JSON) y borrar la cuenta con sus reseñas y votos.
- **Botón de arrepentimiento**: en el pie de todas las páginas; abre el
  formulario de soporte y entrega un código de trámite al instante.

## Soporte

Los visitantes escriben desde `soporte.html` (tipo de consulta, juego, nº de
pedido…) y reciben un código como `TT-1A2B-3C4D` por pantalla y por correo.
Con ese código y su correo pueden ver la conversación y contestar en
"Seguir mi consulta". Tú respondes desde **Panel → Soporte**.

---

## Seguridad

- Contraseña guardada con `password_hash` (bcrypt), nunca en texto plano.
- Sesión con cookie `HttpOnly` + `SameSite=Lax`; bloqueo de 5 minutos tras
  5 intentos fallidos de inicio de sesión.
- La API rechaza peticiones de otros dominios (protección CSRF).
- `data/db.php` empieza con `exit`, así que no se puede leer desde el navegador,
  y `data/.htaccess` bloquea la carpeta.
- Las imágenes se validan por su contenido real (PNG, JPG, GIF, WEBP, AVIF),
  se renombran al azar y en `uploads/` no se puede ejecutar código.
- Todo el texto publicado se escapa antes de mostrarse (sin inyección de HTML).
- Las claves de LevelPlay, las descargas y los correos de los jugadores nunca se
  envían a la parte pública de la web.
- Registro, inicio de sesión y soporte protegidos con el minijuego anti-robots
  (ficha de un solo uso, 10 minutos), límites de frecuencia y trampa anti-bots.
- Cabeceras de seguridad en `.htaccess`: Content-Security-Policy,
  Permissions-Policy, X-Frame-Options y redirección a HTTPS.

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
- Prueba el código Konami en cualquier página: ↑ ↑ ↓ ↓ ← → ← → B A
