<?php
/*
 * THE THING — autenticación del administrador (con PIN por correo)
 *   GET  auth.php?action=status    → ¿hay sesión? ¿falta contraseña? ¿esperando PIN?
 *   POST auth.php?action=setup     → crea la contraseña la primera vez (y envía PIN)
 *   POST auth.php?action=login     → { email, password } → envía PIN al correo
 *   POST auth.php?action=verify    → { pin } → abre la sesión
 *   POST auth.php?action=resend    → reenvía el PIN
 *   POST auth.php?action=logout
 *   POST auth.php?action=password  → cambia la contraseña
 */

declare(strict_types=1);
require_once __DIR__ . '/_lib.php';
require_once __DIR__ . '/_mail.php';

require_same_origin();
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
const PIN_FILE = DATA_DIR . '/ultimo-pin.php';

function admin_session_start(): void
{
    start_session(true);
    session_regenerate_id(true);
    unset($_SESSION['pending_admin']);
    $_SESSION['admin'] = ADMIN_EMAIL;
    $_SESSION['last'] = time();
}

function mask_email(string $email): string
{
    [$user, $domain] = explode('@', $email) + ['', ''];
    return substr($user, 0, 2) . str_repeat('•', max(1, strlen($user) - 2)) . '@' . $domain;
}

/**
 * Genera un PIN, lo guarda (cifrado) y lo envía por correo.
 * Devuelve true si el correo salió.
 */
function issue_pin(): bool
{
    $pin = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    with_db(function (array &$db) use ($pin) {
        $db['admin']['pin'] = [
            'hash' => password_hash($pin, PASSWORD_DEFAULT),
            'expires' => time() + ADMIN_PIN_MINUTES * 60,
            'tries' => 0,
        ];
    }, true);
    start_session(true);
    session_regenerate_id(true);
    $_SESSION['pending_admin'] = time();
    unset($_SESSION['admin']);

    // Copia de emergencia que solo se puede leer desde el Administrador de archivos
    @file_put_contents(PIN_FILE, "<?php http_response_code(404); exit; ?>\nPIN: {$pin}\nGenerado: " . gmdate('Y-m-d H:i') . " UTC (caduca en " . ADMIN_PIN_MINUTES . " min)\n");

    [$html, $text] = mail_pin($pin, $_SERVER['REMOTE_ADDR'] ?? 'desconocida', ADMIN_PIN_MINUTES);
    return send_mail(ADMIN_EMAIL, 'THE THING · Tu PIN de acceso: ' . $pin, $html, $text);
}

function pin_step_response(bool $sent): void
{
    respond(200, [
        'step' => 'pin', 'sentTo' => mask_email(ADMIN_EMAIL), 'mailSent' => $sent, 'minutes' => ADMIN_PIN_MINUTES,
    ]);
}

if ($action === 'status' && $method === 'GET') {
    $needsSetup = with_db(function (array &$db) {
        return ($db['admin']['password'] ?? '') === '';
    });
    $pending = false;
    if (start_session() && !empty($_SESSION['pending_admin'])) {
        $pending = time() - (int) $_SESSION['pending_admin'] < ADMIN_PIN_MINUTES * 60;
    }
    respond(200, ['user' => current_admin(), 'needsSetup' => $needsSetup, 'email' => ADMIN_EMAIL, 'pendingPin' => $pending, 'sentTo' => mask_email(ADMIN_EMAIL)]);
}

if ($method !== 'POST') fail(405, 'Método no permitido');

if ($action === 'setup') {
    $in = read_json();
    $password = (string) ($in['password'] ?? '');
    if (strlen($password) < 8) fail(400, 'La contraseña debe tener al menos 8 caracteres');
    $ok = with_db(function (array &$db) use ($password) {
        if (($db['admin']['password'] ?? '') !== '') return false;
        $db['admin'] = ['email' => ADMIN_EMAIL, 'password' => password_hash($password, PASSWORD_DEFAULT)];
        return true;
    }, true);
    if (!$ok) fail(409, 'La contraseña ya fue configurada');
    if (!ADMIN_2FA) {
        admin_session_start();
        respond(200, ['user' => ADMIN_EMAIL]);
    }
    pin_step_response(issue_pin());
}

if ($action === 'login') {
    $in = read_json();
    $email = strtolower(clean_str($in['email'] ?? '', 200));
    $password = (string) ($in['password'] ?? '');
    $key = 'admin:' . ip_key();

    $result = with_db(function (array &$db) use ($email, $password, $key) {
        if (too_many($db, $key, 5, 300)) return ['locked', 0];
        $emailOk = $email === strtolower($db['admin']['email'] ?? '');
        $valid = $emailOk && ($db['admin']['password'] ?? '') !== '' && password_verify($password, $db['admin']['password']);
        if (!$valid) {
            record_hit($db, $key);
            // Si acertaron el correo, avisamos al administrador (máx. 1 correo cada 15 min)
            if ($emailOk && !too_many($db, 'alert-mail', 1, 900)) {
                record_hit($db, 'alert-mail');
                return ['alert', count($db['attempts'][$key]['hits'] ?? [])];
            }
            return ['bad', 0];
        }
        clear_rate_limit($db, $key);
        return ['ok', 0];
    }, true);

    if ($result[0] === 'locked') fail(429, 'Demasiados intentos. Espera 5 minutos.');
    if ($result[0] === 'alert') {
        [$html, $text] = mail_alert($_SERVER['REMOTE_ADDR'] ?? 'desconocida', $result[1]);
        send_mail(ADMIN_EMAIL, 'THE THING · Alerta: intento de acceso fallido', $html, $text);
    }
    if ($result[0] !== 'ok') fail(401, 'Credenciales incorrectas');
    if (!ADMIN_2FA) {
        admin_session_start();
        respond(200, ['user' => ADMIN_EMAIL]);
    }
    $sendKey = 'pin-send';
    $limited = with_db(function (array &$db) use ($sendKey) {
        return rate_limited($db, $sendKey, 5, 900);
    }, true);
    if ($limited) fail(429, 'Se enviaron demasiados PIN. Espera 15 minutos.');
    pin_step_response(issue_pin());
}

if ($action === 'resend') {
    if (!start_session() || empty($_SESSION['pending_admin'])) fail(401, 'Vuelve a escribir tu contraseña');
    $limited = with_db(function (array &$db) {
        return rate_limited($db, 'pin-send', 5, 900);
    }, true);
    if ($limited) fail(429, 'Se enviaron demasiados PIN. Espera 15 minutos.');
    pin_step_response(issue_pin());
}

if ($action === 'verify') {
    if (!start_session() || empty($_SESSION['pending_admin'])) fail(401, 'Vuelve a escribir tu contraseña');
    $in = read_json();
    $pin = preg_replace('/\D/', '', (string) ($in['pin'] ?? ''));
    $res = with_db(function (array &$db) use ($pin) {
        $p = $db['admin']['pin'] ?? null;
        if (!$p || $p['expires'] < time()) return 'expired';
        if ($p['tries'] >= 5) return 'expired';
        if (!password_verify($pin, $p['hash'])) {
            $db['admin']['pin']['tries']++;
            return $db['admin']['pin']['tries'] >= 5 ? 'expired' : 'bad';
        }
        unset($db['admin']['pin']);
        return 'ok';
    }, true);
    if ($res === 'expired') {
        unset($_SESSION['pending_admin']);
        @unlink(PIN_FILE);
        fail(401, 'El PIN caducó o se usó demasiadas veces. Vuelve a entrar.');
    }
    if ($res === 'bad') fail(400, 'PIN incorrecto');
    @unlink(PIN_FILE);
    admin_session_start();
    respond(200, ['user' => ADMIN_EMAIL]);
}

if ($action === 'logout') {
    if (start_session()) unset($_SESSION['admin'], $_SESSION['pending_admin']);
    respond(200, ['ok' => true]);
}

if ($action === 'password') {
    require_admin();
    $in = read_json();
    $current = (string) ($in['current'] ?? '');
    $next = (string) ($in['next'] ?? '');
    if (strlen($next) < 8) fail(400, 'La nueva contraseña debe tener al menos 8 caracteres');
    $ok = with_db(function (array &$db) use ($current, $next) {
        if (!password_verify($current, $db['admin']['password'] ?? '')) return false;
        $db['admin']['password'] = password_hash($next, PASSWORD_DEFAULT);
        return true;
    }, true);
    if (!$ok) fail(400, 'La contraseña actual no es correcta');
    session_regenerate_id(true);
    respond(200, ['ok' => true]);
}

fail(404, 'Acción no encontrada');
