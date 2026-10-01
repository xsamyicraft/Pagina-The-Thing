<?php
/*
 * THE THING — autenticación del administrador
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

function admin_session_start(): void
{
    start_session(true);
    session_regenerate_id(true);
    $_SESSION['admin'] = ADMIN_EMAIL;
    $_SESSION['last'] = time();
}

if ($action === 'status' && $method === 'GET') {
    $needsSetup = with_db(function (array &$db) {
        return ($db['admin']['password'] ?? '') === '';
    });
    respond(200, ['user' => current_admin(), 'needsSetup' => $needsSetup, 'email' => ADMIN_EMAIL]);
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
    admin_session_start();
    respond(200, ['user' => ADMIN_EMAIL]);
}

if ($action === 'login') {
    $in = read_json();
    $email = strtolower(clean_str($in['email'] ?? '', 200));
    $password = (string) ($in['password'] ?? '');
    $key = 'admin:' . ip_key();

    $result = with_db(function (array &$db) use ($email, $password, $key) {
        if (too_many($db, $key, 5, 300)) return 'locked';
        $valid = $email === strtolower($db['admin']['email'] ?? '')
            && ($db['admin']['password'] ?? '') !== ''
            && password_verify($password, $db['admin']['password']);
        if (!$valid) {
            record_hit($db, $key);
            return 'bad';
        }
        clear_rate_limit($db, $key);
        return 'ok';
    }, true);

    if ($result === 'locked') fail(429, 'Demasiados intentos. Espera 5 minutos.');
    if ($result === 'bad') fail(401, 'Credenciales incorrectas');
    admin_session_start();
    respond(200, ['user' => ADMIN_EMAIL]);
}

if ($action === 'logout') {
    if (start_session()) unset($_SESSION['admin']);
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
