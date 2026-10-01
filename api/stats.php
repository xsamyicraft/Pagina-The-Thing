<?php
/*
 * THE THING — estadísticas y comunidad (solo administradores)
 *   GET  stats.php?action=overview&days=30      → resumen: juegos, comunidad y LevelPlay
 *   POST stats.php?action=levelplay_save        → { secretKey, refreshToken } guarda y prueba la conexión
 *   POST stats.php?action=levelplay_refresh     → fuerza la descarga de datos de LevelPlay
 *   POST stats.php?action=levelplay_clear       → borra las credenciales
 *   GET  stats.php?action=members               → jugadores registrados
 *   POST stats.php?action=delete_member         → { id }
 *   GET  stats.php?action=comments              → reseñas y comentarios (moderación)
 *   GET  stats.php?action=notifications         → avisos enviados
 *   POST stats.php?action=notify                → { title, text, item } envía un aviso a los jugadores
 */

declare(strict_types=1);
require_once __DIR__ . '/_lib.php';
require_once __DIR__ . '/_levelplay.php';

require_same_origin();
require_admin();
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'overview' && $method === 'GET') {
    $days = (int) ($_GET['days'] ?? 30);
    if (!in_array($days, [7, 30, 90], true)) $days = 30;
    $lp = levelplay_report($days);

    $res = with_db(function (array &$db) use ($lp, $days) {
        $s = community_summary($db);
        $ratings = (array) $s['ratings'];
        $best = (array) $s['votes']['best'];
        $played = (array) $s['votes']['played'];
        $comments = (array) $s['comments'];
        $lpApps = $lp['data']['apps'] ?? [];

        $games = [];
        foreach ($db['content'] as $i) {
            if ($i['type'] !== 'app') continue;
            $app = ($i['appKey'] ?? '') !== '' ? ($lpApps[$i['appKey']] ?? null) : null;
            $games[] = [
                'id' => $i['id'], 'title' => $i['title'], 'image' => $i['image'], 'platform' => $i['platform'],
                'downloads' => ($i['downloads'] ?? '') === '' ? null : (int) $i['downloads'],
                'appKey' => $i['appKey'] ?? '',
                'rating' => $ratings[$i['id']]['avg'] ?? null, 'reviews' => $ratings[$i['id']]['count'] ?? 0,
                'comments' => $comments[$i['id']] ?? 0,
                'votesBest' => $best[$i['id']] ?? 0, 'votesPlayed' => $played[$i['id']] ?? 0,
                'levelplay' => $app,
            ];
        }
        $since = gmdate('Y-m-d\TH:i:s\Z', time() - 7 * 86400);
        $members = count($db['members']);
        $newMembers = count(array_filter($db['members'], function ($m) use ($since) {
            return $m['createdAt'] >= $since;
        }));
        $subscribed = count(array_filter($db['members'], function ($m) {
            return !empty($m['emailNotify']);
        }));
        $allRatings = array_filter(array_column($db['comments'], 'rating'));
        // Apps de LevelPlay que no están enlazadas con ningún juego de la web
        $linked = array_filter(array_column($games, 'appKey'));
        $unlinked = array_values(array_filter($lpApps, function ($a) use ($linked) {
            return !in_array($a['appKey'], $linked, true);
        }));
        return [
            'days' => $days,
            'community' => [
                'members' => $members, 'newMembers7d' => $newMembers, 'subscribed' => $subscribed,
                'comments' => count($db['comments']), 'reviews' => count($allRatings),
                'avgRating' => $allRatings ? round(array_sum($allRatings) / count($allRatings), 2) : null,
                'votes' => count($db['votes']),
            ],
            'games' => $games,
            'totalDownloads' => array_sum(array_map(function ($g) {
                return $g['downloads'] ?? 0;
            }, $games)),
            'levelplay' => [
                'configured' => $lp['configured'], 'error' => $lp['error'], 'fetchedAt' => $lp['fetchedAt'],
                'totals' => $lp['data']['totals'] ?? null, 'daily' => $lp['data']['daily'] ?? [],
                'range' => $lp['data']['range'] ?? null, 'unlinkedApps' => $unlinked,
                'hasKeys' => $lp['configured'],
            ],
        ];
    });
    respond(200, $res);
}

if ($action === 'members' && $method === 'GET') {
    $list = with_db(function (array &$db) {
        $counts = [];
        foreach ($db['comments'] as $c) $counts[$c['member']] = ($counts[$c['member']] ?? 0) + 1;
        $out = [];
        foreach ($db['members'] as $m) {
            $out[] = [
                'id' => $m['id'], 'name' => $m['name'], 'email' => $m['email'], 'emailNotify' => !empty($m['emailNotify']),
                'createdAt' => $m['createdAt'], 'comments' => $counts[$m['id']] ?? 0, 'voted' => isset($db['votes'][$m['id']]),
            ];
        }
        usort($out, function ($a, $b) {
            return strcmp($b['createdAt'], $a['createdAt']);
        });
        return $out;
    });
    respond(200, $list);
}

if ($action === 'comments' && $method === 'GET') {
    $list = with_db(function (array &$db) {
        $titles = [];
        foreach ($db['content'] as $i) $titles[$i['id']] = ['title' => $i['title'], 'type' => $i['type']];
        $out = [];
        foreach ($db['comments'] as $c) {
            $m = find_member($db, $c['member']);
            $out[] = [
                'id' => $c['id'], 'item' => $c['item'], 'itemTitle' => $titles[$c['item']]['title'] ?? '—',
                'itemType' => $titles[$c['item']]['type'] ?? '', 'name' => $m ? $m['name'] : 'JUGADOR BORRADO',
                'rating' => $c['rating'] ?? 0, 'text' => $c['text'], 'createdAt' => $c['createdAt'],
            ];
        }
        usort($out, function ($a, $b) {
            return strcmp($b['createdAt'], $a['createdAt']);
        });
        return array_slice($out, 0, 300);
    });
    respond(200, $list);
}

if ($action === 'notifications' && $method === 'GET') {
    respond(200, with_db(function (array &$db) {
        return array_slice($db['notifications'], 0, 50);
    }));
}

if ($method !== 'POST') fail(405, 'Método no permitido');

if ($action === 'levelplay_save') {
    $in = read_json();
    $secret = clean_str($in['secretKey'] ?? '', 200);
    $refresh = clean_str($in['refreshToken'] ?? '', 200);
    $current = with_db(function (array &$db) {
        return $db['levelplay'];
    });
    // Un campo vacío conserva el valor guardado
    $secret = $secret !== '' ? $secret : (string) $current['secretKey'];
    $refresh = $refresh !== '' ? $refresh : (string) $current['refreshToken'];
    if ($secret === '' || $refresh === '') fail(400, 'Faltan la Secret Key o el Refresh Token');
    try {
        $token = lp_fetch_token($secret, $refresh);
    } catch (RuntimeException $e) {
        fail(400, $e->getMessage());
    }
    with_db(function (array &$db) use ($secret, $refresh, $token) {
        $db['levelplay'] = ['secretKey' => $secret, 'refreshToken' => $refresh, 'token' => $token, 'tokenExp' => time() + 50 * 60, 'cache' => null];
    }, true);
    respond(200, ['ok' => true]);
}

if ($action === 'levelplay_refresh') {
    $days = (int) ($_GET['days'] ?? 30);
    if (!in_array($days, [7, 30, 90], true)) $days = 30;
    $lp = levelplay_report($days, true);
    if ($lp['error']) fail(502, $lp['error']);
    respond(200, ['ok' => true, 'fetchedAt' => $lp['fetchedAt']]);
}

if ($action === 'levelplay_clear') {
    with_db(function (array &$db) {
        $db['levelplay'] = ['secretKey' => '', 'refreshToken' => '', 'token' => '', 'tokenExp' => 0, 'cache' => null];
    }, true);
    respond(200, ['ok' => true]);
}

if ($action === 'delete_member') {
    $in = read_json();
    $id = preg_replace('/[^\w-]/', '', (string) ($in['id'] ?? ''));
    $ok = with_db(function (array &$db) use ($id) {
        foreach ($db['members'] as $k => $m) {
            if ($m['id'] !== $id) continue;
            array_splice($db['members'], $k, 1);
            unset($db['votes'][$id]);
            $db['comments'] = array_values(array_filter($db['comments'], function ($c) use ($id) {
                return $c['member'] !== $id;
            }));
            return true;
        }
        return false;
    }, true);
    if (!$ok) fail(404, 'No encontrado');
    respond(200, ['ok' => true]);
}

if ($action === 'notify') {
    $in = read_json();
    $title = clean_str($in['title'] ?? '', 140);
    $text = clean_str($in['text'] ?? '', 400);
    $item = preg_replace('/[^\w-]/', '', (string) ($in['item'] ?? ''));
    if ($title === '') fail(400, 'Escribe un título para el aviso');
    $res = with_db(function (array &$db) use ($title, $text, $item) {
        return add_notification($db, $title, $text, $item, 'aviso');
    }, true);
    $emailed = count($res['recipients']);
    if (function_exists('fastcgi_finish_request')) {
        http_response_code(201);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => true, 'emailed' => $emailed]);
        fastcgi_finish_request();
        send_notification_emails($res['recipients'], $res['notification']);
        exit;
    }
    send_notification_emails($res['recipients'], $res['notification']);
    respond(201, ['ok' => true, 'emailed' => $emailed]);
}

fail(404, 'Acción no encontrada');
