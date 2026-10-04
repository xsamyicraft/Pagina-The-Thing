<?php
/*
 * THE THING — comunidad: reseñas con estrellas, comentarios y votaciones
 *   GET  community.php?action=summary              → valoraciones medias + votos + mis votos
 *   GET  community.php?action=comments&item=ID     → reseñas/comentarios de un juego o noticia
 *   POST community.php?action=comment              → { item, text, rating (1-5, solo juegos) }
 *   POST community.php?action=delete_comment       → { id } (autor o administrador)
 *   POST community.php?action=vote                 → { category: best|played, item }
 *   POST community.php?action=report               → { id, reason } denuncia un comentario
 */

declare(strict_types=1);
require_once __DIR__ . '/_lib.php';

require_same_origin();
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];
$memberId = current_member_id();
$isAdmin = current_admin() !== null;

function find_item(array $db, string $id): ?array
{
    foreach ($db['content'] as $i) if ($i['id'] === $id) return $i;
    return null;
}

if ($action === 'summary' && $method === 'GET') {
    $res = with_db(function (array &$db) use ($memberId) {
        $s = community_summary($db);
        $s['mine'] = (object) ($memberId ? ($db['votes'][$memberId] ?? []) : []);
        return $s;
    });
    respond(200, $res);
}

if ($action === 'comments' && $method === 'GET') {
    $item = preg_replace('/[^\w-]/', '', (string) ($_GET['item'] ?? ''));
    $list = with_db(function (array &$db) use ($item, $memberId, $isAdmin) {
        $out = [];
        foreach ($db['comments'] as $c) {
            if ($c['item'] !== $item) continue;
            $m = find_member($db, $c['member']);
            $out[] = [
                'id' => $c['id'], 'name' => $m ? $m['name'] : 'JUGADOR BORRADO', 'staff' => $m && !empty($m['staff']), 'rating' => $c['rating'] ?? 0,
                'text' => $c['text'], 'createdAt' => $c['createdAt'], 'updatedAt' => $c['updatedAt'] ?? $c['createdAt'],
                'mine' => $memberId !== null && $c['member'] === $memberId, 'canDelete' => $isAdmin || ($memberId !== null && $c['member'] === $memberId),
            ];
        }
        usort($out, function ($a, $b) {
            return strcmp($b['createdAt'], $a['createdAt']);
        });
        return $out;
    });
    respond(200, $list);
}

if ($method !== 'POST') fail(405, 'Método no permitido');

if ($action === 'delete_comment') {
    if (!$memberId && !$isAdmin) fail(401, 'Inicia sesión primero');
    $in = read_json();
    $cid = preg_replace('/[^\w-]/', '', (string) ($in['id'] ?? ''));
    $ok = with_db(function (array &$db) use ($cid, $memberId, $isAdmin) {
        foreach ($db['comments'] as $k => $c) {
            if ($c['id'] !== $cid) continue;
            if (!$isAdmin && $c['member'] !== $memberId) return 'forbidden';
            array_splice($db['comments'], $k, 1);
            $db['reports'] = array_values(array_filter($db['reports'], function ($r) use ($cid) {
                return $r['comment'] !== $cid;
            }));
            return 'ok';
        }
        return 'missing';
    }, true);
    if ($ok === 'forbidden') fail(403, 'No puedes borrar este comentario');
    if ($ok === 'missing') fail(404, 'No encontrado');
    respond(200, ['ok' => true]);
}

if (!$memberId) fail(401, 'Regístrate o inicia sesión para participar');

if ($action === 'comment') {
    $in = read_json();
    $itemId = preg_replace('/[^\w-]/', '', (string) ($in['item'] ?? ''));
    $text = clean_str($in['text'] ?? '', 1000);
    $rating = (int) ($in['rating'] ?? 0);
    if ($text === '' || (function_exists('mb_strlen') ? mb_strlen($text) : strlen($text)) < 2) fail(400, 'Escribe algo en tu mensaje');

    $res = with_db(function (array &$db) use ($itemId, $text, $rating, $memberId) {
        if (!find_member($db, $memberId)) return 'nomember';
        $item = find_item($db, $itemId);
        if (!$item || !in_array($item['type'], ['app', 'news'], true)) return 'noitem';
        $isGame = $item['type'] === 'app';
        if ($isGame && ($rating < 1 || $rating > 5)) return 'rating';
        if (rate_limited($db, 'comment:' . $memberId, 5, 300)) return 'limited';
        $now = now_iso();
        // En los juegos, cada jugador tiene una sola reseña (se actualiza)
        if ($isGame) {
            foreach ($db['comments'] as $k => $c) {
                if ($c['item'] === $itemId && $c['member'] === $memberId) {
                    $db['comments'][$k]['text'] = $text;
                    $db['comments'][$k]['rating'] = $rating;
                    $db['comments'][$k]['updatedAt'] = $now;
                    return ['id' => $c['id'], 'updated' => true];
                }
            }
        }
        $c = ['id' => new_id(), 'item' => $itemId, 'member' => $memberId, 'rating' => $isGame ? $rating : 0, 'text' => $text, 'createdAt' => $now, 'updatedAt' => $now];
        $db['comments'][] = $c;
        return ['id' => $c['id'], 'updated' => false];
    }, true);
    if ($res === 'nomember') fail(401, 'Inicia sesión de nuevo');
    if ($res === 'noitem') fail(404, 'Ese juego o noticia ya no existe');
    if ($res === 'rating') fail(400, 'Elige de 1 a 5 estrellas');
    if ($res === 'limited') fail(429, 'Vas muy rápido. Espera unos minutos.');
    respond(201, $res);
}

if ($action === 'report') {
    $in = read_json();
    $cid = preg_replace('/[^\w-]/', '', (string) ($in['id'] ?? ''));
    $reasons = ['spam' => 'Spam o publicidad', 'ofensivo' => 'Insultos u odio', 'acoso' => 'Acoso', 'spoiler' => 'Spoiler', 'ilegal' => 'Contenido ilegal', 'otro' => 'Otro motivo'];
    $reason = $reasons[(string) ($in['reason'] ?? '')] ?? null;
    if (!$reason) fail(400, 'Elige un motivo');
    $res = with_db(function (array &$db) use ($cid, $reason, $memberId) {
        if (rate_limited($db, 'report:' . $memberId, 10, 3600)) return 'limited';
        $found = false;
        foreach ($db['comments'] as $c) if ($c['id'] === $cid) $found = true;
        if (!$found) return 'missing';
        foreach ($db['reports'] as $r) if ($r['comment'] === $cid && $r['member'] === $memberId) return 'ok';
        $db['reports'][] = ['id' => new_id(), 'comment' => $cid, 'member' => $memberId, 'reason' => $reason, 'createdAt' => now_iso()];
        return 'ok';
    }, true);
    if ($res === 'limited') fail(429, 'Enviaste muchas denuncias. Espera un rato.');
    if ($res === 'missing') fail(404, 'Ese comentario ya no existe');
    respond(200, ['ok' => true]);
}

if ($action === 'vote') {
    $in = read_json();
    $category = (string) ($in['category'] ?? '');
    $itemId = preg_replace('/[^\w-]/', '', (string) ($in['item'] ?? ''));
    if (!in_array($category, VOTE_CATEGORIES, true)) fail(400, 'Categoría inválida');
    $res = with_db(function (array &$db) use ($category, $itemId, $memberId) {
        if (!find_member($db, $memberId)) return 'nomember';
        $item = find_item($db, $itemId);
        if (!$item || $item['type'] !== 'app') return 'noitem';
        $db['votes'][$memberId][$category] = $itemId;
        $s = community_summary($db);
        $s['mine'] = (object) $db['votes'][$memberId];
        return $s;
    }, true);
    if ($res === 'nomember') fail(401, 'Inicia sesión de nuevo');
    if ($res === 'noitem') fail(404, 'Ese juego ya no existe');
    respond(200, $res);
}

fail(404, 'Acción no encontrada');
