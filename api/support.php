<?php
/*
 * THE THING — soporte (consultas con código de seguimiento)
 *   POST support.php?action=create  → { name, email, category, game, order, subject, message, accept, captcha } → { code }
 *   POST support.php?action=lookup  → { code, email }            → consulta y conversación
 *   POST support.php?action=reply   → { code, email, message }   → el usuario contesta
 *   Panel (administrador):
 *   GET  support.php?action=list
 *   POST support.php?action=answer  → { id, message, close }      → responde por correo
 *   POST support.php?action=status  → { id, status: open|answered|closed }
 *   POST support.php?action=delete  → { id }
 */

declare(strict_types=1);
require_once __DIR__ . '/_lib.php';
require_once __DIR__ . '/_mail.php';

require_same_origin();
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

const SUPPORT_CATEGORIES = [
    'cuenta' => 'Cuenta y acceso',
    'juegos' => 'Juegos y errores (bugs)',
    'tienda' => 'Tienda y pedidos',
    'arrepentimiento' => 'Arrepentimiento de compra',
    'privacidad' => 'Privacidad y mis datos',
    'denuncia' => 'Denunciar contenido o conducta',
    'prensa' => 'Prensa y colaboraciones',
    'otro' => 'Otro',
];

function ticket_link(string $code): string
{
    return site_url() . 'soporte.html?codigo=' . rawurlencode($code) . '#seguimiento';
}

function public_ticket(array $t): array
{
    return [
        'code' => $t['code'], 'subject' => $t['subject'], 'category' => $t['category'], 'categoryLabel' => $t['categoryLabel'],
        'status' => $t['status'], 'createdAt' => $t['createdAt'], 'updatedAt' => $t['updatedAt'],
        'messages' => array_map(function ($m) {
            return ['from' => $m['from'], 'text' => $m['text'], 'at' => $m['at']];
        }, $t['messages']),
    ];
}

function find_ticket_by_code(array &$db, string $code, string $email): ?int
{
    foreach ($db['tickets'] as $k => $t) {
        if (hash_equals($t['code'], $code) && hash_equals($t['email'], $email)) return $k;
    }
    return null;
}

function clean_code($v): string
{
    return strtoupper(preg_replace('/[^A-Za-z0-9-]/', '', clean_str($v, 20)));
}

/* ------------------------------------------------------------------ */
/* Público                                                             */
/* ------------------------------------------------------------------ */

if ($action === 'create' && $method === 'POST') {
    $in = read_json();
    if (!empty($in['website'])) fail(400, 'Envío no permitido');     // trampa para bots
    $name = clean_str($in['name'] ?? '', 60);
    $email = clean_email($in['email'] ?? '');
    $category = (string) ($in['category'] ?? '');
    $subject = clean_str($in['subject'] ?? '', 140);
    $message = clean_str($in['message'] ?? '', 4000);
    $order = clean_str($in['order'] ?? '', 80);
    $game = preg_replace('/[^\w-]/', '', clean_str($in['game'] ?? '', 32));
    if (mb_strlen($name) < 2) fail(400, 'Escribe tu nombre');
    if ($email === '') fail(400, 'El correo no es válido');
    if (!isset(SUPPORT_CATEGORIES[$category])) fail(400, 'Elige el tipo de consulta');
    if (mb_strlen($subject) < 3) fail(400, 'Escribe un asunto');
    if (mb_strlen($message) < 10) fail(400, 'Cuéntanos un poco más (mínimo 10 caracteres)');
    if (empty($in['accept'])) fail(400, 'Debes aceptar la política de privacidad');
    require_captcha($in['captcha'] ?? '');

    $memberId = current_member_id() ?? '';
    $ticket = with_db(function (array &$db) use ($name, $email, $category, $subject, $message, $order, $game, $memberId) {
        if (rate_limited($db, 'support:' . ip_key(), 5, 3600)) return 'limited';
        $gameTitle = '';
        foreach ($db['content'] as $i) if ($i['id'] === $game && $i['type'] === 'app') $gameTitle = $i['title'];
        do {
            $code = 'TT-' . strtoupper(bin2hex(random_bytes(2))) . '-' . strtoupper(bin2hex(random_bytes(2)));
            $dup = false;
            foreach ($db['tickets'] as $t) if ($t['code'] === $code) $dup = true;
        } while ($dup);
        $now = now_iso();
        $text = $message;
        if ($order !== '') $text = "Pedido / referencia: {$order}\n\n" . $text;
        if ($gameTitle !== '') $text = "Juego: {$gameTitle}\n" . $text;
        $t = [
            'id' => new_id(), 'code' => $code, 'name' => $name, 'email' => $email, 'category' => $category,
            'categoryLabel' => SUPPORT_CATEGORIES[$category], 'subject' => $subject, 'status' => 'open',
            'member' => $memberId, 'createdAt' => $now, 'updatedAt' => $now,
            'messages' => [['from' => 'user', 'text' => $text, 'at' => $now]],
        ];
        array_unshift($db['tickets'], $t);
        $db['tickets'] = array_slice($db['tickets'], 0, 2000);
        return $t;
    }, true);
    if ($ticket === 'limited') fail(429, 'Enviaste varias consultas seguidas. Espera un rato o escríbenos por correo.');

    [$html, $text] = mail_ticket_user($ticket, ticket_link($ticket['code']));
    $mailed = send_mail($ticket['email'], 'Recibimos tu consulta ' . $ticket['code'] . ' · THE THING', $html, $text);
    [$html, $text] = mail_ticket_admin($ticket, $ticket['messages'][0]['text'], false, site_url() . 'admin.html#support');
    send_mail(ADMIN_EMAIL, '[Soporte] ' . $ticket['code'] . ' · ' . $ticket['subject'], $html, $text);
    respond(201, ['code' => $ticket['code'], 'mailed' => $mailed]);
}

if (($action === 'lookup' || $action === 'reply') && $method === 'POST') {
    $in = read_json();
    $code = clean_code($in['code'] ?? '');
    $email = clean_email($in['email'] ?? '');
    $message = clean_str($in['message'] ?? '', 4000);
    if ($action === 'reply' && mb_strlen($message) < 2) fail(400, 'Escribe tu mensaje');
    $res = with_db(function (array &$db) use ($code, $email, $message, $action) {
        if (rate_limited($db, 'support-lookup:' . ip_key(), 30, 600)) return 'limited';
        $k = find_ticket_by_code($db, $code, $email);
        if ($k === null) return 'missing';
        if ($action === 'reply') {
            $now = now_iso();
            $db['tickets'][$k]['messages'][] = ['from' => 'user', 'text' => $message, 'at' => $now];
            $db['tickets'][$k]['status'] = 'open';
            $db['tickets'][$k]['updatedAt'] = $now;
        }
        return $db['tickets'][$k];
    }, true);
    if ($res === 'limited') fail(429, 'Demasiados intentos. Espera unos minutos.');
    if ($res === 'missing') fail(404, 'No encontramos una consulta con ese código y correo');
    if ($action === 'reply') {
        [$html, $text] = mail_ticket_admin($res, $message, true, site_url() . 'admin.html#support');
        send_mail(ADMIN_EMAIL, '[Soporte] Respuesta en ' . $res['code'], $html, $text);
    }
    respond(200, public_ticket($res));
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

require_admin();

if ($action === 'list' && $method === 'GET') {
    respond(200, with_db(function (array &$db) {
        return ['tickets' => $db['tickets'], 'categories' => SUPPORT_CATEGORIES];
    }));
}

if ($method !== 'POST') fail(405, 'Método no permitido');
$in = read_json();
$id = preg_replace('/[^\w-]/', '', (string) ($in['id'] ?? ''));

if ($action === 'answer') {
    $message = clean_str($in['message'] ?? '', 6000);
    $close = !empty($in['close']);
    if (mb_strlen($message) < 2) fail(400, 'Escribe la respuesta');
    $t = with_db(function (array &$db) use ($id, $message, $close) {
        foreach ($db['tickets'] as $k => $t) {
            if ($t['id'] !== $id) continue;
            $now = now_iso();
            $db['tickets'][$k]['messages'][] = ['from' => 'staff', 'text' => $message, 'at' => $now];
            $db['tickets'][$k]['status'] = $close ? 'closed' : 'answered';
            $db['tickets'][$k]['updatedAt'] = $now;
            return $db['tickets'][$k];
        }
        return null;
    }, true);
    if (!$t) fail(404, 'No encontrado');
    [$html, $text] = mail_ticket_answer($t, $message, $close, ticket_link($t['code']));
    $mailed = send_mail($t['email'], 'Respuesta a tu consulta ' . $t['code'] . ' · THE THING', $html, $text);
    respond(200, ['ticket' => $t, 'mailed' => $mailed]);
}

if ($action === 'status') {
    $status = (string) ($in['status'] ?? '');
    if (!in_array($status, ['open', 'answered', 'closed'], true)) fail(400, 'Estado inválido');
    $t = with_db(function (array &$db) use ($id, $status) {
        foreach ($db['tickets'] as $k => $t) {
            if ($t['id'] !== $id) continue;
            $db['tickets'][$k]['status'] = $status;
            $db['tickets'][$k]['updatedAt'] = now_iso();
            return $db['tickets'][$k];
        }
        return null;
    }, true);
    if (!$t) fail(404, 'No encontrado');
    respond(200, ['ticket' => $t]);
}

if ($action === 'delete') {
    with_db(function (array &$db) use ($id) {
        $db['tickets'] = array_values(array_filter($db['tickets'], function ($t) use ($id) {
            return $t['id'] !== $id;
        }));
    }, true);
    respond(200, ['ok' => true]);
}

fail(404, 'Acción no encontrada');
