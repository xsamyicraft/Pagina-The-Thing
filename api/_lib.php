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
const CONTENT_TYPES = ['app', 'news', 'data', 'image'];

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
    ];
}

function new_id(): string
{
    return bin2hex(random_bytes(8));
}

/**
 * Abre la base de datos con bloqueo, ejecuta $fn(&$db) y, si $write es
 * true, guarda los cambios. Devuelve lo que devuelva $fn.
 */
function with_db(callable $fn, bool $write = false)
{
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
    clearstatcache();
    // Primera ejecución: hace falta escribir los datos iniciales.
    if (!is_file(DB_FILE) || filesize(DB_FILE) === 0) $write = true;
    $fh = fopen(DB_FILE, 'c+');
    if (!$fh) fail(500, 'No se pudo abrir la base de datos (revisa permisos de /data)');
    flock($fh, $write ? LOCK_EX : LOCK_SH);
    $raw = stream_get_contents($fh);
    $db = null;
    if ($raw !== false && $raw !== '') {
        $json = substr($raw, strlen(DB_GUARD));
        $db = json_decode($json, true);
    }
    $fresh = !is_array($db);
    if ($fresh) $db = ['admin' => ['email' => ADMIN_EMAIL, 'password' => ''], 'content' => seed_content(), 'attempts' => []];

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

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name('tt_session');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
    if (isset($_SESSION['last']) && time() - $_SESSION['last'] > SESSION_HOURS * 3600) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    $_SESSION['last'] = time();
}

function current_user(): ?string
{
    start_session();
    return $_SESSION['user'] ?? null;
}

function require_auth(): string
{
    $user = current_user();
    if (!$user) fail(401, 'No autorizado');
    return $user;
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

/* ------------------------------------------------------------------ */
/* Limpieza de entradas                                                */
/* ------------------------------------------------------------------ */

function clean_str($v, int $max): string
{
    $s = trim(is_scalar($v) ? (string) $v : '');
    return function_exists('mb_substr') ? mb_substr($s, 0, $max) : substr($s, 0, $max);
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
    ]);
    if ($item['title'] === '') fail(400, 'El título es obligatorio');
    if ($type === 'image' && $item['image'] === '') fail(400, 'La imagen es obligatoria');
    return $item;
}

function now_iso(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}
