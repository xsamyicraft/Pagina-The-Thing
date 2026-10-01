<?php
/*
 * THE THING — jugadores registrados (usuarios normales)
 *   GET  members.php?action=me             → jugador conectado + avisos sin leer
 *   POST members.php?action=register       → { name, email, password, emailNotify }
 *   POST members.php?action=login          → { email, password }
 *   POST members.php?action=logout
 *   POST members.php?action=prefs          → { emailNotify }
 *   GET  members.php?action=notifications  → lista de avisos
 *   POST members.php?action=seen           → marca los avisos como leídos
 *   GET  members.php?action=unsubscribe&u=ID&t=TOKEN  → baja de correos (enlace del email)
 */

declare(strict_types=1);
require_once __DIR__ . '/_lib.php';

require_same_origin();
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

function public_member(array $m): array
{
    return [
        'id' => $m['id'], 'name' => $m['name'], 'email' => $m['email'],
        'emailNotify' => !empty($m['emailNotify']), 'createdAt' => $m['createdAt'],
    ];
}

/** Avisos visibles para un jugador: los publicados desde 14 días antes de registrarse. */
function member_notifications(array $db, array $m): array
{
    $since = gmdate('Y-m-d\TH:i:s\Z', strtotime($m['createdAt']) - 14 * 86400);
    $list = array_values(array_filter($db['notifications'], function ($n) use ($since) {
        return $n['createdAt'] >= $since;
    }));
    $welcome = [
        'id' => 'welcome', 'kind' => 'aviso', 'title' => '¡Bienvenido a THE THING, ' . $m['name'] . '!',
        'text' => 'Aquí te avisaremos de juegos nuevos, noticias y novedades del estudio.',
        'item' => '', 'createdAt' => $m['createdAt'],
    ];
    $list[] = $welcome;
    $lastSeen = $m['lastSeen'] ?? '';
    $unread = count(array_filter($list, function ($n) use ($lastSeen) {
        return $n['createdAt'] > $lastSeen;
    }));
    return ['items' => array_slice($list, 0, 50), 'unread' => $unread, 'lastSeen' => $lastSeen];
}

function member_login(string $id): void
{
    start_session(true);
    session_regenerate_id(true);
    $_SESSION['member'] = $id;
}

/* --- Baja de correos (se abre desde el email, devuelve HTML) --- */
if ($action === 'unsubscribe' && $method === 'GET') {
    $u = preg_replace('/[^\w-]/', '', (string) ($_GET['u'] ?? ''));
    $t = (string) ($_GET['t'] ?? '');
    $ok = with_db(function (array &$db) use ($u, $t) {
        if (!hash_equals(hash_hmac('sha256', 'unsub:' . $u, $db['secret']), $t)) return false;
        foreach ($db['members'] as $k => $m) {
            if ($m['id'] === $u) {
                $db['members'][$k]['emailNotify'] = false;
                return true;
            }
        }
        return false;
    }, true);
    header('Content-Type: text/html; charset=utf-8');
    $msg = $ok ? 'Listo: ya no recibirás correos de novedades.' : 'El enlace no es válido.';
    echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>THE THING</title><body style="background:#0a0a0b;color:#ebe6d8;font-family:monospace;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:16px">'
        . '<div><h1 style="color:#8dff7a">THE THING</h1><p>' . htmlspecialchars($msg) . '</p><p><a style="color:#38e8ff" href="../">Volver a la web</a></p></div>';
    exit;
}

if ($action === 'me' && $method === 'GET') {
    $id = current_member_id();
    if (!$id) respond(200, ['member' => null, 'unread' => 0]);
    $res = with_db(function (array &$db) use ($id) {
        $m = find_member($db, $id);
        return $m ? ['member' => public_member($m), 'unread' => member_notifications($db, $m)['unread']] : null;
    });
    if (!$res) {
        unset($_SESSION['member']);
        respond(200, ['member' => null, 'unread' => 0]);
    }
    respond(200, $res);
}

if ($action === 'notifications' && $method === 'GET') {
    $id = current_member_id();
    if (!$id) fail(401, 'Inicia sesión para ver tus avisos');
    $res = with_db(function (array &$db) use ($id) {
        $m = find_member($db, $id);
        return $m ? member_notifications($db, $m) : null;
    });
    if (!$res) fail(401, 'Inicia sesión para ver tus avisos');
    respond(200, $res);
}

if ($method !== 'POST') fail(405, 'Método no permitido');

if ($action === 'register') {
    $in = read_json();
    if (!empty($in['website'])) fail(400, 'Registro no permitido');   // trampa para bots
    $name = clean_str($in['name'] ?? '', 24);
    $email = clean_email($in['email'] ?? '');
    $password = (string) ($in['password'] ?? '');
    if (!preg_match('/^[\p{L}\p{N} _.\-]{3,24}$/u', $name)) fail(400, 'El nombre de jugador debe tener de 3 a 24 letras o números');
    if ($email === '') fail(400, 'El correo no es válido');
    if (strlen($password) < 8) fail(400, 'La contraseña debe tener al menos 8 caracteres');
    if ($email === strtolower(ADMIN_EMAIL)) fail(400, 'Ese correo está reservado');

    $member = with_db(function (array &$db) use ($name, $email, $password, $in) {
        if (rate_limited($db, 'register:' . ip_key(), 5, 3600)) return 'limited';
        foreach ($db['members'] as $m) {
            if ($m['email'] === $email) return 'email';
            if (mb_strtolower($m['name']) === mb_strtolower($name)) return 'name';
        }
        $m = [
            'id' => new_id(), 'name' => $name, 'email' => $email,
            'password' => password_hash($password, PASSWORD_DEFAULT),
            'emailNotify' => !empty($in['emailNotify']),
            'createdAt' => now_iso(), 'lastSeen' => '',
        ];
        $db['members'][] = $m;
        return $m;
    }, true);
    if ($member === 'limited') fail(429, 'Demasiados registros desde esta conexión. Prueba más tarde.');
    if ($member === 'email') fail(409, 'Ya existe una cuenta con ese correo');
    if ($member === 'name') fail(409, 'Ese nombre de jugador ya está ocupado');
    member_login($member['id']);
    respond(201, ['member' => public_member($member), 'unread' => 1]);
}

if ($action === 'login') {
    $in = read_json();
    $email = clean_email($in['email'] ?? '');
    $password = (string) ($in['password'] ?? '');
    $key = 'member:' . ip_key();
    $res = with_db(function (array &$db) use ($email, $password, $key) {
        if (too_many($db, $key, 8, 300)) return 'locked';
        foreach ($db['members'] as $m) {
            if ($m['email'] === $email && password_verify($password, $m['password'])) {
                clear_rate_limit($db, $key);
                return ['member' => public_member($m), 'unread' => member_notifications($db, $m)['unread']];
            }
        }
        record_hit($db, $key);
        return 'bad';
    }, true);
    if ($res === 'locked') fail(429, 'Demasiados intentos. Espera 5 minutos.');
    if ($res === 'bad') fail(401, 'Correo o contraseña incorrectos');
    member_login($res['member']['id']);
    respond(200, $res);
}

if ($action === 'logout') {
    if (start_session()) unset($_SESSION['member']);
    respond(200, ['ok' => true]);
}

$id = current_member_id();
if (!$id) fail(401, 'Inicia sesión primero');

if ($action === 'prefs') {
    $in = read_json();
    $res = with_db(function (array &$db) use ($id, $in) {
        foreach ($db['members'] as $k => $m) {
            if ($m['id'] !== $id) continue;
            if (array_key_exists('emailNotify', $in)) $db['members'][$k]['emailNotify'] = !empty($in['emailNotify']);
            return public_member($db['members'][$k]);
        }
        return null;
    }, true);
    if (!$res) fail(401, 'Inicia sesión primero');
    respond(200, ['member' => $res]);
}

if ($action === 'seen') {
    with_db(function (array &$db) use ($id) {
        foreach ($db['members'] as $k => $m) if ($m['id'] === $id) $db['members'][$k]['lastSeen'] = now_iso();
    }, true);
    respond(200, ['ok' => true]);
}

fail(404, 'Acción no encontrada');
