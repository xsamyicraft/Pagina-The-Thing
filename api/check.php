<?php
/*
 * THE THING — diagnóstico rápido del servidor.
 * Abre https://tudominio.com/api/check.php para comprobar que PHP funciona
 * y que las carpetas tienen permisos de escritura. No muestra datos privados.
 */

declare(strict_types=1);
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$root = __DIR__ . '/..';
$checks = [
    'php_version' => PHP_VERSION,
    'php_ok' => version_compare(PHP_VERSION, '7.4.0', '>='),
    'data_writable' => is_dir($root . '/data') && is_writable($root . '/data'),
    'uploads_writable' => is_dir($root . '/uploads') && is_writable($root . '/uploads'),
    'curl' => function_exists('curl_init'),
    'mbstring' => function_exists('mb_substr'),
    'fileinfo' => class_exists('finfo'),
    'mail' => function_exists('mail'),
    'sessions' => function_exists('session_start'),
    'gd_captcha' => function_exists('imagecreatetruecolor'),   // si falta, el minijuego usa SVG
];
$checks['todo_ok'] = $checks['php_ok'] && $checks['data_writable'] && $checks['uploads_writable']
    && $checks['mbstring'] && $checks['fileinfo'] && $checks['sessions'];
echo json_encode($checks, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
