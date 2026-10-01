<?php
/*
 * THE THING — contenido (juegos/apps, noticias, datos, galería)
 *   GET  content.php                 → todo el contenido
 *   GET  content.php?type=news       → filtrado por tipo (app, news, data, image)
 *   GET  content.php?id=XXXX         → un elemento
 *   POST content.php?action=create   → crear (requiere sesión de administrador)
 *   POST content.php?action=update&id=XXXX
 *   POST content.php?action=delete&id=XXXX
 *
 * Al crear o editar se puede enviar "notify": true para avisar a los
 * jugadores registrados (campana de la web y, si lo pidieron, correo).
 */

declare(strict_types=1);
require_once __DIR__ . '/_lib.php';

require_same_origin();
$method = $_SERVER['REQUEST_METHOD'];
$id = preg_replace('/[^\w-]/', '', (string) ($_GET['id'] ?? ''));

if ($method === 'GET') {
    $isAdmin = current_admin() !== null;
    $content = with_db(function (array &$db) {
        return $db['content'];
    });
    $out = function (array $item) use ($isAdmin): array {
        return $isAdmin ? $item : public_item($item);
    };
    if ($id !== '') {
        foreach ($content as $item) if ($item['id'] === $id) respond(200, $out($item));
        fail(404, 'No encontrado');
    }
    $type = $_GET['type'] ?? '';
    if ($type !== '') $content = array_values(array_filter($content, function ($i) use ($type) {
        return $i['type'] === $type;
    }));
    usort($content, function ($a, $b) {
        return strcmp($b['createdAt'], $a['createdAt']);
    });
    respond(200, array_map($out, $content));
}

if ($method !== 'POST') fail(405, 'Método no permitido');
require_admin();
$action = $_GET['action'] ?? '';

/** Texto de la notificación según el tipo de contenido. */
function notification_for(array $item, bool $isNew): array
{
    $labels = [
        'app' => $isNew ? 'Nuevo juego' : 'Juego actualizado',
        'news' => $isNew ? 'Nueva noticia' : 'Noticia actualizada',
        'data' => $isNew ? 'Nuevo dato' : 'Dato actualizado',
        'image' => $isNew ? 'Nueva imagen en la galería' : 'Imagen actualizada',
        'video' => $isNew ? 'Nuevo vídeo' : 'Vídeo actualizado',
        'product' => $isNew ? 'Nuevo en la tienda' : 'Tienda actualizada',
    ];
    $prefix = $labels[$item['type']] ?? 'Novedad';
    return [$prefix . ': ' . $item['title'], $item['summary'] ?? ''];
}

if ($action === 'create' || $action === 'update') {
    $in = read_json();
    $notify = !empty($in['notify']);
    $result = with_db(function (array &$db) use ($action, $id, $in, $notify) {
        $now = now_iso();
        if ($action === 'create') {
            $item = array_merge(['id' => new_id()], sanitize_content($in), ['createdAt' => $now, 'updatedAt' => $now]);
            $db['content'][] = $item;
        } else {
            $item = null;
            foreach ($db['content'] as $k => $existing) {
                if ($existing['id'] !== $id) continue;
                $old = $existing['image'] ?? '';
                $item = array_merge(sanitize_content($in, $existing), ['updatedAt' => $now]);
                $db['content'][$k] = $item;
                if ($old !== $item['image']) delete_upload_if_unused($db, $old);
                break;
            }
            if (!$item) return null;
        }
        $mail = null;
        if ($notify) {
            [$title, $text] = notification_for($item, $action === 'create');
            $mail = add_notification($db, $title, $text, in_array($item['type'], ['app', 'news', 'image', 'video', 'product'], true) ? $item['id'] : '', $item['type']);
        }
        return ['item' => $item, 'mail' => $mail];
    }, true);
    if (!$result) fail(404, 'No encontrado');

    $emailed = 0;
    if ($result['mail']) {
        // Responde primero y envía los correos después (si el servidor lo permite)
        $emailed = count($result['mail']['recipients']);
    }
    $payload = $result['item'] + ['_emailed' => $emailed];
    if ($result['mail'] && function_exists('fastcgi_finish_request')) {
        http_response_code($action === 'create' ? 201 : 200);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        fastcgi_finish_request();
        send_notification_emails($result['mail']['recipients'], $result['mail']['notification']);
        exit;
    }
    if ($result['mail']) send_notification_emails($result['mail']['recipients'], $result['mail']['notification']);
    respond($action === 'create' ? 201 : 200, $payload);
}

if ($action === 'delete') {
    $ok = with_db(function (array &$db) use ($id) {
        foreach ($db['content'] as $k => $item) {
            if ($item['id'] !== $id) continue;
            array_splice($db['content'], $k, 1);
            delete_upload_if_unused($db, $item['image'] ?? '');
            // Limpia reseñas, votos y notificaciones de ese elemento
            $db['comments'] = array_values(array_filter($db['comments'], function ($c) use ($id) {
                return $c['item'] !== $id;
            }));
            foreach ($db['votes'] as $mid => $v) {
                foreach (VOTE_CATEGORIES as $cat) if (($v[$cat] ?? '') === $id) unset($db['votes'][$mid][$cat]);
            }
            foreach ($db['notifications'] as $nk => $n) if (($n['item'] ?? '') === $id) $db['notifications'][$nk]['item'] = '';
            return true;
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
