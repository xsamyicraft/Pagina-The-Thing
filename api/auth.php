<?php
/*
 * THE THING — autenticación
 *   GET  auth.php?action=status    → ¿hay sesión? ¿falta configurar contraseña?
 *   POST auth.php?action=setup     → crea la contraseña la primera vez
 *   POST auth.php?action=login     → inicia sesión
 *   POST auth.php?action=logout    → cierra sesión
 *   POST auth.php?action=password  → cambia la contraseña
 */

declare(strict_types=1);
require_once __DIR__ . '/_lib.php';

require_same_origin();
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'status' && $method === 'GET') {
    $needsSetup = with_db(function (array &$db) {
        return ($db['admin']['password'] ?? '') === '';
    });
    respond(200, ['user' => current_user(), 'needsSetup' => $needsSetup, 'email' => ADMIN_EMAIL]);
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
    start_session();
    session_regenerate_id(true);
    $_SESSION['user'] = ADMIN_EMAIL;
    respond(200, ['user' => ADMIN_EMAIL]);
}

if ($action === 'login') {
    $in = read_json();
    $email = strtolower(clean_str($in['email'] ?? '', 200));
    $password = (string) ($in['password'] ?? '');
    $ip = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown');

    $result = with_db(function (array &$db) use ($email, $password, $ip) {
        $now = time();
        foreach ($db['attempts'] ?? [] as $k => $a) {
            if (($a['until'] ?? 0) < $now && ($a['last'] ?? 0) < $now - 3600) unset($db['attempts'][$k]);
        }
        $a = $db['attempts'][$ip] ?? ['count' => 0, 'until' => 0, 'last' => 0];
        if ($a['until'] > $now) return 'locked';

        $valid = $email === strtolower($db['admin']['email'] ?? '')
            && ($db['admin']['password'] ?? '') !== ''
            && password_verify($password, $db['admin']['password']);
        if (!$valid) {
            $a['count']++;
            $a['last'] = $now;
            if ($a['count'] >= 5) {
                $a = ['count' => 0, 'until' => $now + 300, 'last' => $now];
            }
            $db['attempts'][$ip] = $a;
            return 'bad';
        }
        unset($db['attempts'][$ip]);
        return 'ok';
    }, true);

    if ($result === 'locked') fail(429, 'Demasiados intentos. Espera 5 minutos.');
    if ($result === 'bad') fail(401, 'Credenciales incorrectas');
    start_session();
    session_regenerate_id(true);
    $_SESSION['user'] = ADMIN_EMAIL;
    respond(200, ['user' => ADMIN_EMAIL]);
}

if ($action === 'logout') {
    start_session();
    $_SESSION = [];
    $p = session_get_cookie_params();
    setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Strict']);
    session_destroy();
    respond(200, ['ok' => true]);
}

if ($action === 'password') {
    require_auth();
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
