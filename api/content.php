<?php
/*
 * THE THING — contenido (juegos/apps, noticias, datos, galería)
 *   GET  content.php                 → todo el contenido
 *   GET  content.php?type=news       → filtrado por tipo (app, news, data, image)
 *   GET  content.php?id=XXXX         → un elemento
 *   POST content.php?action=create   → crear (requiere sesión)
 *   POST content.php?action=update&id=XXXX
 *   POST content.php?action=delete&id=XXXX
 */

declare(strict_types=1);
require_once __DIR__ . '/_lib.php';

require_same_origin();
$method = $_SERVER['REQUEST_METHOD'];
$id = preg_replace('/[^\w-]/', '', (string) ($_GET['id'] ?? ''));

if ($method === 'GET') {
    $content = with_db(function (array &$db) {
        return $db['content'];
    });
    if ($id !== '') {
        foreach ($content as $item) if ($item['id'] === $id) respond(200, $item);
        fail(404, 'No encontrado');
    }
    $type = $_GET['type'] ?? '';
    if ($type !== '') $content = array_values(array_filter($content, function ($i) use ($type) {
        return $i['type'] === $type;
    }));
    usort($content, function ($a, $b) {
        return strcmp($b['createdAt'], $a['createdAt']);
    });
    respond(200, $content);
}

if ($method !== 'POST') fail(405, 'Método no permitido');
require_auth();
$action = $_GET['action'] ?? '';

if ($action === 'create') {
    $in = read_json();
    $item = sanitize_content($in);
    $now = now_iso();
    $item = array_merge(['id' => new_id()], $item, ['createdAt' => $now, 'updatedAt' => $now]);
    with_db(function (array &$db) use ($item) {
        $db['content'][] = $item;
    }, true);
    respond(201, $item);
}

if ($action === 'update') {
    $in = read_json();
    $updated = with_db(function (array &$db) use ($id, $in) {
        foreach ($db['content'] as $k => $item) {
            if ($item['id'] === $id) {
                $old = $item['image'] ?? '';
                $db['content'][$k] = array_merge(sanitize_content($in, $item), ['updatedAt' => now_iso()]);
                if ($old !== $db['content'][$k]['image']) delete_upload_if_unused($db, $old);
                return $db['content'][$k];
            }
        }
        return null;
    }, true);
    if (!$updated) fail(404, 'No encontrado');
    respond(200, $updated);
}

if ($action === 'delete') {
    $ok = with_db(function (array &$db) use ($id) {
        foreach ($db['content'] as $k => $item) {
            if ($item['id'] === $id) {
                array_splice($db['content'], $k, 1);
                delete_upload_if_unused($db, $item['image'] ?? '');
                return true;
            }
        }
        return false;
    }, true);
    if (!$ok) fail(404, 'No encontrado');
    respond(200, ['ok' => true]);
}

fail(404, 'Acción no encontrada');

function delete_upload_if_unused(array $db, string $url): void
{
    if (strpos($url, 'uploads/') !== 0) return;
    foreach ($db['content'] as $item) if (($item['image'] ?? '') === $url) return;
    $file = UPLOAD_DIR . '/' . basename($url);
    if (is_file($file)) @unlink($file);
}
