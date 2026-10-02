<?php
/*
 * THE THING — utilidades comunes de la API (PHP 7.4+ / 8.x)
 * Pensado para hosting compartido (Hostinger): sin base de datos externa,
 * los datos se guardan en data/db.php (protegido para que no se pueda leer
 * desde el navegador).
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

const ROOT_DIR = __DIR__ . '/..';
const DATA_DIR = ROOT_DIR . '/data';
const UPLOAD_DIR = ROOT_DIR . '/uploads';
const DB_FILE = DATA_DIR . '/db.php';
const DB_GUARD = "<?php http_response_code(404); exit; ?>\n";
const CONTENT_TYPES = ['app', 'news', 'data', 'image', 'video', 'product'];
const VOTE_CATEGORIES = ['best', 'played'];
// Campos que solo ve el administrador (no se publican en la web)
const PRIVATE_FIELDS = ['appKey', 'downloads', 'playPackage'];
// Versión de los términos que acepta cada jugador al registrarse
const TERMS_VERSION = '2026-10';

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Cache-Control: no-store');

/* ------------------------------------------------------------------ */
/* Respuestas                                                          */
/* ------------------------------------------------------------------ */

function respond(int $status, $data): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(int $status, string $message): void
{
    respond($status, ['error' => $message]);
}

function read_json(): array
{
    $type = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($type, 'application/json') !== 0) fail(415, 'Se esperaba JSON');
    $raw = file_get_contents('php://input', false, null, 0, 1024 * 1024);
    $data = json_decode($raw ?: '{}', true);
    if (!is_array($data)) fail(400, 'JSON inválido');
    return $data;
}

/* ------------------------------------------------------------------ */
/* Base de datos en archivo                                            */
/* ------------------------------------------------------------------ */

function seed_content(): array
{
    $iso = function (int $days): string {
        return gmdate('Y-m-d\TH:i:s\Z', time() - $days * 86400);
    };
    $item = function (array $fields) use ($iso): array {
        $base = [
            'id' => new_id(), 'type' => '', 'title' => '', 'summary' => '', 'body' => '', 'image' => '',
            'link' => '', 'platform' => '', 'status' => '', 'value' => '', 'featured' => false,
            'appKey' => '', 'downloads' => '', 'playPackage' => '', 'videoUrl' => '', 'price' => '', 'sizes' => '',
        ];
        $created = $iso($fields['_days'] ?? 0);
        unset($fields['_days']);
        return array_merge($base, $fields, ['createdAt' => $created, 'updatedAt' => $created]);
    };
    return [
        $item(['_days' => 2, 'type' => 'app', 'title' => 'PROYECTO: THE THING', 'platform' => 'PC', 'status' => 'En desarrollo', 'featured' => true,
            'summary' => 'Nuestro primer título. Un survival de terror retro donde nada es lo que parece… ni siquiera el gato.',
            'body' => "Estamos trabajando en nuestro primer juego. Muy pronto compartiremos más detalles, capturas y una demo jugable.\n\nSíguenos para no perderte nada."]),
        $item(['_days' => 1, 'type' => 'news', 'title' => 'Bienvenidos a THE THING', 'featured' => true,
            'summary' => 'Nace un nuevo estudio independiente de videojuegos. Esto es lo que viene.',
            'body' => "Hoy encendemos la máquina por primera vez.\n\n**THE THING** es un estudio nuevo con una idea clara: hacer juegos raros, memorables y con alma de cartucho viejo.\n\nEn este sitio publicaremos nuestros proyectos, noticias, datos del desarrollo e imágenes detrás de cámaras."]),
        $item(['_days' => 0, 'type' => 'news', 'title' => 'Diario de desarrollo #0',
            'summary' => 'Primeros bocetos, primeras ideas y demasiadas tazas de café.',
            'body' => 'Esta es una noticia de ejemplo. Puedes editarla o borrarla desde el panel de administración.']),
        $item(['_days' => 3, 'type' => 'data', 'title' => 'Proyectos en marcha', 'value' => '1', 'summary' => 'Y contando.']),
        $item(['_days' => 3, 'type' => 'data', 'title' => 'Tazas de café', 'value' => '9999', 'summary' => 'Estimación conservadora.']),
        $item(['_days' => 3, 'type' => 'data', 'title' => 'Bugs aplastados', 'value' => '404', 'summary' => 'Los que encontramos.']),
        $item(['_days' => 3, 'type' => 'data', 'title' => 'Año de fundación', 'value' => gmdate('Y'), 'summary' => 'Insert coin.']),
        $item(['_days' => 4, 'type' => 'image', 'title' => 'El logo', 'summary' => 'La cosa nos observa.', 'image' => 'assets/img/logo.webp']),
        $item(['_days' => 5, 'type' => 'product', 'title' => 'Camiseta "The Thing"', 'price' => '24.99', 'sizes' => 'S, M, L, XL', 'status' => 'Disponible',
            'summary' => 'Camiseta negra 100% algodón con el gato glitch.', 'image' => 'assets/img/logo-small.webp']),
        $item(['_days' => 5, 'type' => 'product', 'title' => 'Taza "Insert Coin"', 'price' => '12.50', 'status' => 'Próximamente',
            'summary' => 'Para el café de las sesiones de desarrollo nocturnas.']),
    ];
}

function new_id(): string
{
    return bin2hex(random_bytes(8));
}

/** Completa las colecciones que falten (también migra bases antiguas). */
function normalize_db(?array $db): array
{
    if (!is_array($db)) {
        $db = ['admin' => ['email' => ADMIN_EMAIL, 'password' => ''], 'content' => seed_content()];
    }
    $defaults = [
        'admin' => ['email' => ADMIN_EMAIL, 'password' => ''],
        'content' => [],
        'attempts' => [],
        'members' => [],
        'comments' => [],
        'votes' => [],          // [memberId => ['best' => itemId, 'played' => itemId]]
        'notifications' => [],
        'levelplay' => ['secretKey' => '', 'refreshToken' => '', 'token' => '', 'tokenExp' => 0, 'cache' => null],
        'googleplay' => ['serviceAccount' => '', 'bucket' => '', 'cache' => null],
        'tickets' => [],        // consultas de soporte
        'reports' => [],        // comentarios denunciados por los jugadores
        'settings' => [],       // datos de la empresa y redes (páginas legales y pie)
    ];
    foreach ($defaults as $k => $v) {
        if (!isset($db[$k]) || !is_array($db[$k])) $db[$k] = $v;
    }
    if (empty($db['secret'])) $db['secret'] = bin2hex(random_bytes(32));
    return $db;
}

/**
 * Abre la base de datos con bloqueo, ejecuta $fn(&$db) y, si $write es
 * true, guarda los cambios. Devuelve lo que devuelva $fn.
 */
function with_db(callable $fn, bool $write = false)
{
    if (!is_dir(DATA_DIR)) @mkdir(DATA_DIR, 0755, true);
    clearstatcache();
    // Primera ejecución: hace falta escribir los datos iniciales.
    if (!is_file(DB_FILE) || filesize(DB_FILE) === 0) $write = true;
    $fh = @fopen(DB_FILE, 'c+');
    if (!$fh) fail(500, 'No se pudo abrir la base de datos (revisa que la carpeta /data exista y tenga permisos 755)');
    flock($fh, $write ? LOCK_EX : LOCK_SH);
    $raw = stream_get_contents($fh);
    $db = null;
    if ($raw !== false && $raw !== '') {
        $db = json_decode(substr($raw, strlen(DB_GUARD)), true);
    }
    $before = $db;
    $db = normalize_db($db);
    if ($db !== $before) $write = true;   // migración o datos iniciales

    if ($write && !flock($fh, LOCK_EX)) fail(500, 'No se pudo bloquear la base de datos');
    $result = $fn($db);

    if ($write) {
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, DB_GUARD . json_encode($db, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
        fflush($fh);
    }
    flock($fh, LOCK_UN);
    fclose($fh);
    return $result;
}

/* ------------------------------------------------------------------ */
/* Sesión y seguridad                                                  */
/* ------------------------------------------------------------------ */

/**
 * Inicia la sesión PHP. Si $create es false y el visitante no tiene cookie,
 * no se crea ninguna (los visitantes anónimos no reciben cookies).
 */
function start_session(bool $create = false): bool
{
    if (session_status() === PHP_SESSION_ACTIVE) return true;
    if (!$create && empty($_COOKIE['tt_session'])) return false;

    $dir = DATA_DIR . '/sessions';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    if (is_dir($dir) && is_writable($dir)) session_save_path($dir);
    $lifetime = MEMBER_SESSION_DAYS * 86400;
    ini_set('session.gc_maxlifetime', (string) $lifetime);
    ini_set('session.use_strict_mode', '1');

    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name('tt_session');
    session_set_cookie_params([
        'lifetime' => $lifetime,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
    // El administrador se desconecta tras SESSION_HOURS sin actividad
    if (isset($_SESSION['admin'], $_SESSION['last']) && time() - $_SESSION['last'] > SESSION_HOURS * 3600) {
        unset($_SESSION['admin']);
    }
    $_SESSION['last'] = time();
    return true;
}

function current_admin(): ?string
{
    if (!start_session()) return null;
    return $_SESSION['admin'] ?? null;
}

function require_admin(): string
{
    $admin = current_admin();
    if (!$admin) fail(401, 'No autorizado');
    return $admin;
}

function current_member_id(): ?string
{
    if (!start_session()) return null;
    return $_SESSION['member'] ?? null;
}

function find_member(array $db, ?string $id): ?array
{
    if (!$id) return null;
    foreach ($db['members'] as $m) if ($m['id'] === $id) return $m;
    return null;
}

/** Bloquea peticiones que modifican datos si vienen de otro dominio. */
function require_same_origin(): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'GET') return;
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'TheThing') fail(403, 'Petición no permitida');
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return;
    $host = parse_url($origin, PHP_URL_HOST);
    $port = parse_url($origin, PHP_URL_PORT);
    $originHost = $host . ($port ? ':' . $port : '');
    if (strcasecmp($originHost, $_SERVER['HTTP_HOST'] ?? '') !== 0) fail(403, 'Origen no permitido');
}

function ip_key(): string
{
    return hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

/** ¿Se alcanzaron $max acciones en los últimos $window segundos? */
function too_many(array &$db, string $key, int $max, int $window): bool
{
    $now = time();
    foreach ($db['attempts'] as $k => $a) {
        if (!isset($a['hits']) || !$a['hits'] || max($a['hits']) < $now - 86400) unset($db['attempts'][$k]);
    }
    $hits = array_values(array_filter($db['attempts'][$key]['hits'] ?? [], function ($t) use ($now, $window) {
        return $t > $now - $window;
    }));
    if ($hits) $db['attempts'][$key] = ['hits' => $hits];
    return count($hits) >= $max;
}

function record_hit(array &$db, string $key): void
{
    $db['attempts'][$key]['hits'][] = time();
}

/** Comprueba el límite y, si no se superó, registra esta acción. */
function rate_limited(array &$db, string $key, int $max, int $window): bool
{
    if (too_many($db, $key, $max, $window)) return true;
    record_hit($db, $key);
    return false;
}

function clear_rate_limit(array &$db, string $key): void
{
    unset($db['attempts'][$key]);
}

/* ------------------------------------------------------------------ */
/* Limpieza de entradas                                                */
/* ------------------------------------------------------------------ */

function clean_str($v, int $max): string
{
    $s = trim(is_scalar($v) ? (string) $v : '');
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s) ?? '';
    return function_exists('mb_substr') ? mb_substr($s, 0, $max) : substr($s, 0, $max);
}

function clean_email($v): string
{
    $s = strtolower(clean_str($v, 200));
    return filter_var($s, FILTER_VALIDATE_EMAIL) ? $s : '';
}

function clean_url($v): string
{
    $s = clean_str($v, 500);
    if ($s === '') return '';
    if (preg_match('#^(uploads|assets)/[\w./-]+$#', $s) && strpos($s, '..') === false) return $s;
    if (filter_var($s, FILTER_VALIDATE_URL) && preg_match('#^https?://#i', $s)) return $s;
    return '';
}

function sanitize_content(array $in, array $existing = []): array
{
    $type = $existing['type'] ?? clean_str($in['type'] ?? '', 10);
    if (!in_array($type, CONTENT_TYPES, true)) fail(400, 'Tipo de contenido inválido');
    $downloads = preg_replace('/[^\d]/', '', clean_str($in['downloads'] ?? '', 20));
    $item = array_merge($existing, [
        'type' => $type,
        'title' => clean_str($in['title'] ?? '', 140),
        'summary' => clean_str($in['summary'] ?? '', 400),
        'body' => clean_str($in['body'] ?? '', 20000),
        'image' => clean_url($in['image'] ?? ''),
        'link' => clean_url($in['link'] ?? ''),
        'platform' => clean_str($in['platform'] ?? '', 80),
        'status' => clean_str($in['status'] ?? '', 40),
        'value' => clean_str($in['value'] ?? '', 40),
        'featured' => !empty($in['featured']),
        'appKey' => preg_replace('/[^\w-]/', '', clean_str($in['appKey'] ?? '', 64)),
        'downloads' => $downloads,
        'playPackage' => preg_replace('/[^\w.]/', '', clean_str($in['playPackage'] ?? '', 150)),
        'videoUrl' => clean_url($in['videoUrl'] ?? ''),
        'price' => preg_replace('/[^\d.]/', '', str_replace(',', '.', clean_str($in['price'] ?? '', 12))),
        'sizes' => clean_str($in['sizes'] ?? '', 120),
        'game' => $type === 'news' ? preg_replace('/[^\w-]/', '', clean_str($in['game'] ?? '', 32)) : '',
        'currency' => in_array(strtoupper((string) ($in['currency'] ?? '')), ['USD', 'MXN', 'EUR', 'ARS', 'COP', 'CLP', 'PEN'], true) ? strtoupper((string) $in['currency']) : 'USD',
    ]);
    if ($item['title'] === '') fail(400, 'El título es obligatorio');
    if ($type === 'image' && $item['image'] === '') fail(400, 'La imagen es obligatoria');
    if ($type === 'video' && $item['videoUrl'] === '') fail(400, 'Falta el vídeo (enlace de YouTube/Vimeo o archivo subido)');
    return $item;
}

/** Quita los campos privados (solo para el panel) de un elemento. */
function public_item(array $item): array
{
    foreach (PRIVATE_FIELDS as $f) unset($item[$f]);
    return $item;
}

/* ------------------------------------------------------------------ */
/* Captcha (minijuego): cada ficha superada vale para una sola acción  */
/* ------------------------------------------------------------------ */

function require_captcha($token): void
{
    $token = is_string($token) ? preg_replace('/[^a-f0-9]/', '', $token) : '';
    start_session(true);
    $now = time();
    $tokens = $_SESSION['captcha_tokens'] ?? [];
    foreach ($tokens as $t => $exp) if ($exp < $now) unset($tokens[$t]);
    $ok = $token !== '' && isset($tokens[$token]);
    unset($tokens[$token]);
    $_SESSION['captcha_tokens'] = $tokens;
    if (!$ok) fail(400, 'Completa el minijuego anti-robots para continuar');
}

/* ------------------------------------------------------------------ */
/* Datos de la empresa (páginas legales y pie de página)               */
/* ------------------------------------------------------------------ */

const SETTINGS_FIELDS = [
    'legalName' => 140, 'tradeName' => 80, 'taxId' => 60, 'address' => 200, 'country' => 40, 'jurisdiction' => 120,
    'registry' => 200, 'email' => 120, 'supportEmail' => 120, 'privacyEmail' => 120, 'minAge' => 2,
    'youtube' => 300, 'tiktok' => 300, 'instagram' => 300, 'x' => 300, 'discord' => 300, 'facebook' => 300, 'twitch' => 300,
];

function public_settings(array $db): array
{
    $out = ['tradeName' => 'THE THING', 'email' => 'contacto@thethinggame.com', 'supportEmail' => 'soporte@thethinggame.com', 'minAge' => '13'];
    foreach (SETTINGS_FIELDS as $k => $max) {
        $v = $db['settings'][$k] ?? '';
        if ($v !== '' || !isset($out[$k])) $out[$k] = $v;
    }
    $out['updatedAt'] = $db['settings']['updatedAt'] ?? '';
    return $out;
}

function sanitize_settings(array $in): array
{
    $out = [];
    foreach (SETTINGS_FIELDS as $k => $max) {
        $v = clean_str($in[$k] ?? '', $max);
        if (in_array($k, ['email', 'supportEmail', 'privacyEmail'], true) && $v !== '') {
            $v = clean_email($v);
            if ($v === '') fail(400, 'Revisa el correo del campo «' . $k . '»');
        }
        if (in_array($k, ['youtube', 'tiktok', 'instagram', 'x', 'discord', 'facebook', 'twitch'], true) && $v !== '') {
            $v = clean_url($v);
            if ($v === '' || strpos($v, 'http') !== 0) fail(400, 'El enlace de ' . $k . ' debe empezar por https://');
        }
        if ($k === 'minAge') $v = (string) max(13, min(18, (int) ($v ?: 13)));
        $out[$k] = $v;
    }
    $out['updatedAt'] = now_iso();
    return $out;
}

function now_iso(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

/* ------------------------------------------------------------------ */
/* Comunidad: valoraciones y votos                                     */
/* ------------------------------------------------------------------ */

function community_summary(array $db): array
{
    $ratings = [];
    foreach ($db['comments'] as $c) {
        if (empty($c['rating'])) continue;
        $id = $c['item'];
        $ratings[$id] = $ratings[$id] ?? ['sum' => 0, 'count' => 0];
        $ratings[$id]['sum'] += (int) $c['rating'];
        $ratings[$id]['count']++;
    }
    foreach ($ratings as $id => $r) {
        $ratings[$id] = ['avg' => round($r['sum'] / $r['count'], 2), 'count' => $r['count']];
    }
    $votes = ['best' => [], 'played' => []];
    foreach ($db['votes'] as $v) {
        foreach (VOTE_CATEGORIES as $cat) {
            if (!empty($v[$cat])) $votes[$cat][$v[$cat]] = ($votes[$cat][$v[$cat]] ?? 0) + 1;
        }
    }
    $comments = [];
    foreach ($db['comments'] as $c) $comments[$c['item']] = ($comments[$c['item']] ?? 0) + 1;
    return ['ratings' => (object) $ratings, 'votes' => ['best' => (object) $votes['best'], 'played' => (object) $votes['played']], 'comments' => (object) $comments];
}

/* ------------------------------------------------------------------ */
/* Notificaciones y correo                                             */
/* ------------------------------------------------------------------ */

function site_url(): string
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $base = rtrim(str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/api/x.php'))), '/');
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $base . '/';
}

/**
 * Crea una notificación para los jugadores registrados.
 * Devuelve la lista de destinatarios que pidieron recibirla por correo.
 */
function add_notification(array &$db, string $title, string $text, string $itemId = '', string $kind = 'aviso'): array
{
    $n = [
        'id' => new_id(), 'kind' => $kind, 'title' => clean_str($title, 140), 'text' => clean_str($text, 400),
        'item' => $itemId, 'createdAt' => now_iso(),
    ];
    array_unshift($db['notifications'], $n);
    $db['notifications'] = array_slice($db['notifications'], 0, 200);
    $recipients = [];
    foreach ($db['members'] as $m) {
        if (!empty($m['emailNotify'])) {
            $recipients[] = ['email' => $m['email'], 'name' => $m['name'], 'unsub' => unsubscribe_link($db, $m['id'])];
        }
    }
    return ['notification' => $n, 'recipients' => $recipients];
}

function unsubscribe_link(array $db, string $memberId): string
{
    $t = hash_hmac('sha256', 'unsub:' . $memberId, $db['secret']);
    return site_url() . 'api/members.php?action=unsubscribe&u=' . rawurlencode($memberId) . '&t=' . $t;
}

/** Envía la novedad por correo con la plantilla retro. */
function send_notification_emails(array $recipients, array $n): int
{
    require_once __DIR__ . '/_mail.php';
    $sent = 0;
    $link = site_url() . ($n['item'] ? '#ver-' . $n['item'] : '');
    foreach (array_slice($recipients, 0, 500) as $r) {
        [$html, $text] = mail_notification($r['name'], $n, $link, $r['unsub']);
        if (send_mail($r['email'], 'THE THING · ' . $n['title'], $html, $text, $r['unsub'])) $sent++;
    }
    return $sent;
}
