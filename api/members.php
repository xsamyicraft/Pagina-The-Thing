<?php
/*
 * THE THING — jugadores registrados (usuarios normales)
 *   GET  members.php?action=me             → jugador conectado + avisos sin leer
 *   POST members.php?action=register       → { name, email, password, emailNotify, accept, captcha }
 *   POST members.php?action=login          → { email, password, captcha }
 *   POST members.php?action=logout
 *   POST members.php?action=prefs          → { emailNotify }
 *   GET  members.php?action=notifications  → lista de avisos
 *   POST members.php?action=seen           → marca los avisos como leídos
 *   GET  members.php?action=export         → descarga de todos mis datos (JSON)
 *   POST members.php?action=delete         → { password } borra la cuenta y sus datos
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

if ($action === 'export' && $method === 'GET') {
    $id = current_member_id();
    if (!$id) fail(401, 'Inicia sesión primero');
    $data = with_db(function (array &$db) use ($id) {
        $m = find_member($db, $id);
        if (!$m) return null;
        $titles = [];
        foreach ($db['content'] as $i) $titles[$i['id']] = $i['title'];
        $comments = [];
        foreach ($db['comments'] as $c) {
            if ($c['member'] !== $id) continue;
            $comments[] = ['sobre' => $titles[$c['item']] ?? $c['item'], 'estrellas' => $c['rating'] ?? 0, 'texto' => $c['text'], 'creado' => $c['createdAt'], 'editado' => $c['updatedAt'] ?? $c['createdAt']];
        }
        $votes = [];
        foreach ($db['votes'][$id] ?? [] as $cat => $item) $votes[$cat] = $titles[$item] ?? $item;
        $tickets = [];
        foreach ($db['tickets'] as $t) {
            if ($t['email'] !== $m['email']) continue;
            $tickets[] = ['codigo' => $t['code'], 'asunto' => $t['subject'], 'estado' => $t['status'], 'mensajes' => $t['messages']];
        }
        return [
            'exportado' => now_iso(),
            'web' => site_url(),
            'cuenta' => ['nombre' => $m['name'], 'correo' => $m['email'], 'creada' => $m['createdAt'], 'avisosPorCorreo' => !empty($m['emailNotify']), 'consentimiento' => $m['consent'] ?? null],
            'reseñasYComentarios' => $comments,
            'votos' => (object) $votes,
            'consultasDeSoporte' => $tickets,
        ];
    });
    if (!$data) fail(401, 'Inicia sesión primero');
    header('Content-Disposition: attachment; filename="mis-datos-thething.json"');
    respond(200, $data);
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
    if (empty($in['accept'])) fail(400, 'Debes aceptar los Términos y la Política de privacidad');
    require_captcha($in['captcha'] ?? '');

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
            'consent' => ['terms' => TERMS_VERSION, 'at' => now_iso(), 'emailNotify' => !empty($in['emailNotify'])],
        ];
        $db['members'][] = $m;
        return $m;
    }, true);
    if ($member === 'limited') fail(429, 'Demasiados registros desde esta conexión. Prueba más tarde.');
    if ($member === 'email') fail(409, 'Ya existe una cuenta con ese correo');
    if ($member === 'name') fail(409, 'Ese nombre de jugador ya está ocupado');
    member_login($member['id']);
    if ($member['emailNotify']) {
        require_once __DIR__ . '/_mail.php';
        $unsub = with_db(function (array &$db) use ($member) {
            return unsubscribe_link($db, $member['id']);
        });
        [$html, $text] = mail_welcome($member['name'], $unsub);
        send_mail($member['email'], '¡Bienvenido a THE THING, ' . $member['name'] . '!', $html, $text, $unsub);
    }
    respond(201, ['member' => public_member($member), 'unread' => 1]);
}

if ($action === 'login') {
    $in = read_json();
    $email = clean_email($in['email'] ?? '');
    $password = (string) ($in['password'] ?? '');
    require_captcha($in['captcha'] ?? '');
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

if ($action === 'delete') {
    $in = read_json();
    $password = (string) ($in['password'] ?? '');
    $res = with_db(function (array &$db) use ($id, $password) {
        if (rate_limited($db, 'member-delete:' . $id, 6, 900)) return 'limited';
        $m = find_member($db, $id);
        if (!$m) return 'missing';
        if (!password_verify($password, $m['password'])) return 'bad';
        $db['members'] = array_values(array_filter($db['members'], function ($x) use ($id) {
            return $x['id'] !== $id;
        }));
        $mine = [];
        foreach ($db['comments'] as $c) if ($c['member'] === $id) $mine[] = $c['id'];
        $db['comments'] = array_values(array_filter($db['comments'], function ($c) use ($id) {
            return $c['member'] !== $id;
        }));
        $db['reports'] = array_values(array_filter($db['reports'], function ($r) use ($id, $mine) {
            return $r['member'] !== $id && !in_array($r['comment'], $mine, true);
        }));
        unset($db['votes'][$id]);
        foreach ($db['tickets'] as $k => $t) if (($t['member'] ?? '') === $id) $db['tickets'][$k]['member'] = '';
        return 'ok';
    }, true);
    if ($res === 'limited') fail(429, 'Demasiados intentos. Espera unos minutos.');
    if ($res === 'bad') fail(400, 'La contraseña no es correcta');
    if ($res === 'missing') fail(401, 'Inicia sesión primero');
    unset($_SESSION['member']);
    respond(200, ['ok' => true]);
}

if ($action === 'seen') {
    with_db(function (array &$db) use ($id) {
        foreach ($db['members'] as $k => $m) if ($m['id'] === $id) $db['members'][$k]['lastSeen'] = now_iso();
    }, true);
    respond(200, ['ok' => true]);
}

fail(404, 'Acción no encontrada');
