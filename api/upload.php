<?php
/*
 * THE THING — subida de imágenes (multipart/form-data, campo "file")
 * Devuelve { "url": "uploads/xxxx.webp" }
 */

declare(strict_types=1);
require_once __DIR__ . '/_lib.php';

require_same_origin();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'Método no permitido');
require_auth();

$file = $_FILES['file'] ?? null;
if (!$file || !is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    $code = $file['error'] ?? UPLOAD_ERR_NO_FILE;
    if ($code === UPLOAD_ERR_INI_SIZE || $code === UPLOAD_ERR_FORM_SIZE) fail(413, 'La imagen es demasiado grande para el servidor');
    fail(400, 'No se recibió ninguna imagen');
}
if ($file['size'] > MAX_UPLOAD_MB * 1024 * 1024) fail(413, 'La imagen supera ' . MAX_UPLOAD_MB . ' MB');

$allowed = [
    'image/png' => 'png',
    'image/jpeg' => 'jpg',
    'image/gif' => 'gif',
    'image/webp' => 'webp',
    'image/avif' => 'avif',
];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($file['tmp_name']) ?: '';
if (!isset($allowed[$mime])) fail(415, 'Formato no permitido (usa PNG, JPG, GIF, WEBP o AVIF)');

if (!is_dir(UPLOAD_DIR)) mkdir(UPLOAD_DIR, 0755, true);
$name = base_convert((string) time(), 10, 36) . '-' . bin2hex(random_bytes(6)) . '.' . $allowed[$mime];
if (!move_uploaded_file($file['tmp_name'], UPLOAD_DIR . '/' . $name)) fail(500, 'No se pudo guardar la imagen (revisa permisos de /uploads)');

respond(201, ['url' => 'uploads/' . $name]);
