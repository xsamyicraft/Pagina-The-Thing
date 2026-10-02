<?php
/*
 * THE THING — datos de la empresa y redes sociales
 *   GET  settings.php               → datos públicos (páginas legales y pie de página)
 *   POST settings.php?action=save   → guardar (requiere sesión de administrador)
 */

declare(strict_types=1);
require_once __DIR__ . '/_lib.php';

require_same_origin();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    respond(200, with_db(function (array &$db) {
        return public_settings($db);
    }));
}

if ($method !== 'POST' || ($_GET['action'] ?? '') !== 'save') fail(404, 'Acción no encontrada');
require_admin();
$settings = sanitize_settings(read_json());
respond(200, with_db(function (array &$db) use ($settings) {
    $db['settings'] = $settings;
    return public_settings($db);
}, true));
