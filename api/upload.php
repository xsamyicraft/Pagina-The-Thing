<?php
/*
 * THE THING — subida de imágenes y vídeos (multipart/form-data, campo "file")
 * Devuelve { "url": "uploads/xxxx.webp" }
 */

declare(strict_types=1);
require_once __DIR__ . '/_lib.php';

require_same_origin();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'Método no permitido');
require_admin();

$file = $_FILES['file'] ?? null;
if (!$file || !is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    $code = $file['error'] ?? UPLOAD_ERR_NO_FILE;
    if ($code === UPLOAD_ERR_INI_SIZE || $code === UPLOAD_ERR_FORM_SIZE) {
        fail(413, 'El archivo supera el límite del servidor (' . ini_get('upload_max_filesize') . '). Usa un enlace de YouTube para vídeos grandes.');
    }
    fail(400, 'No se recibió ningún archivo');
}

$images = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/gif' => 'gif', 'image/webp' => 'webp', 'image/avif' => 'avif'];
$videos = ['video/mp4' => 'mp4', 'video/webm' => 'webm'];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($file['tmp_name']) ?: '';

if (isset($images[$mime])) {
    if ($file['size'] > MAX_UPLOAD_MB * 1024 * 1024) fail(413, 'La imagen supera ' . MAX_UPLOAD_MB . ' MB');
    $ext = $images[$mime];
} elseif (isset($videos[$mime])) {
    if ($file['size'] > MAX_VIDEO_MB * 1024 * 1024) fail(413, 'El vídeo supera ' . MAX_VIDEO_MB . ' MB');
    $ext = $videos[$mime];
} else {
    fail(415, 'Formato no permitido (imágenes PNG, JPG, GIF, WEBP, AVIF o vídeos MP4, WEBM)');
}

if (!is_dir(UPLOAD_DIR)) mkdir(UPLOAD_DIR, 0755, true);
$name = base_convert((string) time(), 10, 36) . '-' . bin2hex(random_bytes(6)) . '.' . $ext;
if (!move_uploaded_file($file['tmp_name'], UPLOAD_DIR . '/' . $name)) fail(500, 'No se pudo guardar el archivo (revisa permisos de /uploads)');

respond(201, ['url' => 'uploads/' . $name]);
