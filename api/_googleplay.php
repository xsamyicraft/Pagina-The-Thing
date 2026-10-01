<?php
/*
 * THE THING — descargas reales desde Google Play
 *
 * Google Play Console exporta cada día los informes de instalaciones a un
 * "bucket" de Google Cloud Storage (pubsite_prod_rev_XXXXXXXX). Con una cuenta
 * de servicio de Google Cloud que tenga permiso en Play Console para
 * "Ver información de la app y descargar informes masivos", leemos:
 *   stats/installs/installs_<paquete>_<AAAAMM>_overview.csv
 * y tomamos la columna "Total User Installs" (instalaciones totales de
 * usuarios únicos) del último día disponible.
 */

declare(strict_types=1);

const GP_SCOPE = 'https://www.googleapis.com/auth/devstorage.read_only';
const GP_STORAGE = 'https://storage.googleapis.com/storage/v1/b/';

function gp_http(string $method, string $url, array $headers = [], ?string $body = null): array
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 30, CURLOPT_CONNECTTIMEOUT => 10,
        ]);
        if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        $res = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        return $res === false ? [0, 'Error de red: ' . $err] : [$status, (string) $res];
    }
    $ctx = stream_context_create(['http' => [
        'method' => $method, 'header' => implode("\r\n", $headers), 'content' => $body ?? '', 'timeout' => 30, 'ignore_errors' => true,
    ]]);
    $res = @file_get_contents($url, false, $ctx);
    $status = 0;
    foreach ($http_response_header ?? [] as $h) if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) $status = (int) $m[1];
    return $res === false ? [0, 'Error de red al contactar Google'] : [$status, (string) $res];
}

function gp_b64url(string $s): string
{
    return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
}

/** Valida el JSON de la cuenta de servicio. Devuelve el array o lanza excepción. */
function gp_parse_account(string $json): array
{
    $acc = json_decode($json, true);
    if (!is_array($acc) || empty($acc['client_email']) || empty($acc['private_key'])) {
        throw new RuntimeException('El JSON de la cuenta de servicio no es válido (debe tener client_email y private_key)');
    }
    return $acc;
}

/** Normaliza "gs://pubsite_prod_rev_123/" → "pubsite_prod_rev_123". */
function gp_clean_bucket(string $b): string
{
    $b = trim($b);
    $b = preg_replace('#^gs://#', '', $b);
    return preg_replace('#[^a-z0-9_.-]#i', '', explode('/', $b)[0]);
}

function gp_token(array $acc): string
{
    if (!function_exists('openssl_sign')) throw new RuntimeException('El servidor no tiene OpenSSL activado');
    $now = time();
    $aud = $acc['token_uri'] ?? 'https://oauth2.googleapis.com/token';
    $jwt = gp_b64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT'])) . '.' . gp_b64url(json_encode([
        'iss' => $acc['client_email'], 'scope' => GP_SCOPE, 'aud' => $aud, 'iat' => $now, 'exp' => $now + 3600,
    ]));
    $key = openssl_pkey_get_private($acc['private_key']);
    if (!$key || !openssl_sign($jwt, $sig, $key, OPENSSL_ALGO_SHA256)) throw new RuntimeException('No se pudo firmar con la clave privada de la cuenta de servicio');
    $jwt .= '.' . gp_b64url($sig);
    [$status, $body] = gp_http('POST', $aud, ['Content-Type: application/x-www-form-urlencoded'], http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => $jwt,
    ]));
    $data = json_decode($body, true);
    if ($status !== 200 || empty($data['access_token'])) {
        throw new RuntimeException('Google rechazó la cuenta de servicio (HTTP ' . $status . '): ' . substr(strip_tags($body), 0, 200));
    }
    return $data['access_token'];
}

/** Lista los informes mensuales de instalaciones de un paquete. */
function gp_list_overviews(string $token, string $bucket, string $package): array
{
    $url = GP_STORAGE . rawurlencode($bucket) . '/o?' . http_build_query(['prefix' => 'stats/installs/installs_' . $package . '_', 'fields' => 'items(name)']);
    [$status, $body] = gp_http('GET', $url, ['Authorization: Bearer ' . $token]);
    if ($status === 403) throw new RuntimeException('Sin permiso para leer el bucket. Invita a la cuenta de servicio en Play Console → Usuarios y permisos.');
    if ($status === 404) throw new RuntimeException('No existe el bucket "' . $bucket . '". Cópialo de Play Console → Descargar informes → URI de Cloud Storage.');
    if ($status !== 200) throw new RuntimeException('Error de Google Cloud Storage (HTTP ' . $status . ')');
    $names = array_column(json_decode($body, true)['items'] ?? [], 'name');
    $names = array_values(array_filter($names, function ($n) {
        return (bool) preg_match('#_\d{6}_overview\.csv$#', $n);
    }));
    sort($names);
    return $names;
}

function gp_download(string $token, string $bucket, string $name): string
{
    [$status, $body] = gp_http('GET', GP_STORAGE . rawurlencode($bucket) . '/o/' . rawurlencode($name) . '?alt=media', ['Authorization: Bearer ' . $token]);
    if ($status !== 200) throw new RuntimeException('No se pudo descargar ' . basename($name) . ' (HTTP ' . $status . ')');
    // Los CSV de Play Console vienen en UTF-16
    if (strncmp($body, "\xFF\xFE", 2) === 0) $body = mb_convert_encoding(substr($body, 2), 'UTF-8', 'UTF-16LE');
    elseif (strncmp($body, "\xFE\xFF", 2) === 0) $body = mb_convert_encoding(substr($body, 2), 'UTF-8', 'UTF-16BE');
    elseif (strncmp($body, "\xEF\xBB\xBF", 3) === 0) $body = substr($body, 3);
    return $body;
}

/** Lee un CSV de instalaciones y devuelve filas asociativas. */
function gp_parse_csv(string $csv): array
{
    $lines = preg_split('/\r\n|\n|\r/', trim($csv));
    $head = array_map('trim', str_getcsv(array_shift($lines)));
    $rows = [];
    foreach ($lines as $l) {
        if (trim($l) === '') continue;
        $cols = str_getcsv($l);
        if (count($cols) !== count($head)) continue;
        $rows[] = array_combine($head, array_map('trim', $cols));
    }
    return $rows;
}

/** Descargas de un paquete: total acumulado + instalaciones de los últimos 30 días. */
function gp_package_stats(string $token, string $bucket, string $package): array
{
    $files = gp_list_overviews($token, $bucket, $package);
    if (!$files) throw new RuntimeException('Aún no hay informes de "' . $package . '" (Play Console tarda unos días en generarlos) o el nombre del paquete no es correcto');
    $rows = [];
    foreach (array_slice($files, -2) as $f) $rows = array_merge($rows, gp_parse_csv(gp_download($token, $bucket, $f)));
    usort($rows, function ($a, $b) {
        return strcmp($a['Date'] ?? '', $b['Date'] ?? '');
    });
    $total = null;
    for ($i = count($rows) - 1; $i >= 0; $i--) {
        if (($rows[$i]['Total User Installs'] ?? '') !== '') {
            $total = (int) $rows[$i]['Total User Installs'];
            break;
        }
    }
    $since = gmdate('Y-m-d', time() - 30 * 86400);
    $last30 = 0;
    $daily = [];
    foreach ($rows as $r) {
        $d = $r['Date'] ?? '';
        $n = (int) ($r['Daily User Installs'] ?? $r['Daily Device Installs'] ?? 0);
        if ($d >= $since) {
            $last30 += $n;
            $daily[] = ['date' => $d, 'installs' => $n];
        }
    }
    if ($total === null) throw new RuntimeException('El informe de "' . $package . '" no tiene la columna "Total User Installs"');
    return ['total' => $total, 'last30' => $last30, 'daily' => $daily, 'lastDate' => end($rows)['Date'] ?? ''];
}

/**
 * Descargas de varios paquetes, con caché de PLAY_CACHE_HOURS.
 * Devuelve ['configured' => bool, 'error' => ?string, 'packages' => [paquete => stats|['error'=>...]]]
 */
function googleplay_downloads(array $packages, bool $force = false): array
{
    $cfg = with_db(function (array &$db) {
        return $db['googleplay'];
    });
    if (empty($cfg['serviceAccount']) || empty($cfg['bucket'])) return ['configured' => false, 'error' => null, 'packages' => []];
    $cache = $cfg['cache'] ?? [];
    $out = [];
    $todo = [];
    foreach (array_unique(array_filter($packages)) as $p) {
        $c = $cache[$p] ?? null;
        if (!$force && $c && strtotime($c['fetchedAt']) > time() - PLAY_CACHE_HOURS * 3600) $out[$p] = $c;
        else $todo[] = $p;
    }
    if (!$todo) return ['configured' => true, 'error' => null, 'packages' => $out];
    try {
        $token = gp_token(gp_parse_account($cfg['serviceAccount']));
    } catch (RuntimeException $e) {
        foreach ($todo as $p) if (isset($cache[$p])) $out[$p] = $cache[$p];
        return ['configured' => true, 'error' => $e->getMessage(), 'packages' => $out];
    }
    $fresh = [];
    foreach ($todo as $p) {
        try {
            $fresh[$p] = gp_package_stats($token, $cfg['bucket'], $p) + ['fetchedAt' => now_iso()];
            $out[$p] = $fresh[$p];
        } catch (RuntimeException $e) {
            $out[$p] = ($cache[$p] ?? []) + ['error' => $e->getMessage()];
        }
    }
    if ($fresh) {
        with_db(function (array &$db) use ($fresh) {
            $db['googleplay']['cache'] = array_merge($db['googleplay']['cache'] ?? [], $fresh);
        }, true);
    }
    return ['configured' => true, 'error' => null, 'packages' => $out];
}
